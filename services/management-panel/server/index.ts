import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { promises as fs } from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { SERVER_PRESETS } from './presets.js';
import openapiSpec from './openapi.js';

dotenv.config({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3001;

const execAsync = promisify(exec);

async function dockerAction(appId: string, action: 'start' | 'stop' | 'restart'): Promise<{success: boolean; output: string}> {
  const { data: app, error } = await supabase
    .from('docker_apps')
    .select('container_id, user_id')
    .eq('id', appId)
    .single();
  if (error || !app) throw new Error('App not found');
  if (!app.container_id) throw new Error('No container associated with this app');
  const { stdout, stderr } = await execAsync(`docker ${action} ${app.container_id}`);
  return { success: true, output: stdout || stderr };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const customersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Simple observability instrumentation
const APP_VERSION = process.env.APP_VERSION || 'dev';
const metrics: {
  requests: number;
  totalDurationMs: number;
  endpoints: Record<string, { count: number; totalMs: number }>;
} = {
  requests: 0,
  totalDurationMs: 0,
  endpoints: {},
};

// Basic request instrumentation middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.requests += 1;
    metrics.totalDurationMs += duration;
    const key = req.path;
    const ep = metrics.endpoints[key] || { count: 0, totalMs: 0 };
    ep.count += 1;
    ep.totalMs += duration;
    metrics.endpoints[key] = ep;
    // Simple log for observability during development
    console.log(`[infra-pilot] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key';
let supabase = createClient(supabaseUrl, supabaseKey);

export function setSupabaseClientForTests(client: ReturnType<typeof createClient>) {
  supabase = client;
}

export { app };

// Middleware
app.use(cors());
app.use(express.json());

// Health and observability-aware health
const APP_HEALTH = {
  status: 'ok',
  uptime: process.uptime(),
  version: APP_VERSION,
  metrics,
};

// Auth middleware: Verify JWT token from Authorization header
const verifyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  (req as any).user = data.user;
  next();
};

async function logAudit(userId: string, action: string, entityType: string, entityId?: string, oldValue?: any, newValue?: any, ipAddress?: string) {
  try {
    await supabase
      .from('audit_log')
      .insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        ip_address: ipAddress || null,
      });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// ============================================================================
// SETUP ROUTES
// ============================================================================

// GET /api/setup/status - Check setup status
app.get('/api/setup/status', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('setup_config')
      .select('*')
      .single();

    if (error && error.code === 'PGRST116') {
      // No setup config yet
      return res.json({ initialized: false, mode: null });
    }

    res.json({
      initialized: data?.initialized || false,
      mode: data?.mode || 'personal',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// POST /api/setup/init - Initialize setup (create first admin user & mode selection)
app.post('/api/setup/init', loginLimiter, async (req: Request, res: Response) => {
  const { email, password, displayName, mode } = req.body;

  if (!email || !password || !mode || !['personal', 'business'].includes(mode)) {
    return res.status(400).json({ error: 'Missing or invalid parameters' });
  }

  try {
    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Failed to create user' });
    }

    const userId = authData.user.id;

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        display_name: displayName || email.split('@')[0],
        role: 'admin',
      });

    if (profileError) {
      // Clean up user if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Create setup config
    const { error: setupError } = await supabase
      .from('setup_config')
      .insert({
        mode,
        initialized: true,
        admin_user_id: userId,
      });

    if (setupError) {
      return res.status(500).json({ error: 'Failed to initialize setup' });
    }

    // Return session token
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      return res.status(500).json({ error: 'Failed to create session' });
    }

    res.json({
      success: true,
      mode,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Setup initialization failed' });
  }
});

// ============================================================================
// DOCKER APP ROUTES (require auth)
// ============================================================================


// GET /api/presets - List server presets
app.get('/api/presets', verifyAuth, async (_req: Request, res: Response) => {
  res.json(SERVER_PRESETS);
});

// GET /api/apps - List all apps for current user
app.get('/api/apps', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const { data, error } = await supabase
      .from('docker_apps')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

// POST /api/apps - Create a new Docker app
app.post('/api/apps', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, image, ports, environmentVars, volumes, memoryLimit, cpuShares, description } = req.body;

  if (!name || !image) {
    return res.status(400).json({ error: 'Name and image are required' });
  }

  try {
    const { data, error } = await supabase
      .from('docker_apps')
      .insert({
        user_id: userId,
        name,
        image,
        status: 'stopped',
        ports: ports || [],
        environment_vars: environmentVars || {},
        volumes: volumes || [],
        memory_limit: memoryLimit,
        cpu_shares: cpuShares,
        description,
      })
      .select()
      .single();

    if (error) throw error;
    await logAudit(userId, 'app:create', 'app', data.id, null, { name, image });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create app' });
  }
});

// GET /api/apps/:appId - Get app details
app.get('/api/apps/:appId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { appId } = req.params;

  try {
    const { data, error } = await supabase
      .from('docker_apps')
      .select('*')
      .eq('id', appId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'App not found' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch app' });
  }
});

// PATCH /api/apps/:appId - Update app settings
app.patch('/api/apps/:appId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { appId } = req.params;

  try {
    const { data, error } = await supabase
      .from('docker_apps')
      .update(req.body)
      .eq('id', appId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'App not found' });
    }

    await logAudit(userId, 'app:update', 'app', appId, null, req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update app' });
  }
});

// DELETE /api/apps/:appId - Delete an app
app.delete('/api/apps/:appId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { appId } = req.params;

  try {
    const { error } = await supabase
      .from('docker_apps')
      .delete()
      .eq('id', appId)
      .eq('user_id', userId);

    if (error) throw error;
    await logAudit(userId, 'app:delete', 'app', appId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete app' });
  }
});

// ============================================================================
// DOCKER CONTROL ROUTES (require auth)
// ============================================================================

// POST /api/apps/:appId/start - Start a container
app.post('/api/apps/:appId/start', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { appId } = req.params;

  try {
    const dockerResult = await dockerAction(appId, 'start');
    const { data, error } = await supabase
      .from('docker_apps')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', appId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) throw error;
    await logAudit(userId, 'app:start', 'app', appId);
    res.json({ ...data, docker: dockerResult });
  } catch (err: any) {
    if (err.message?.includes('App not found') || err.message?.includes('No container')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message?.includes('docker') || err.code === 'ENOENT') {
      return res.status(502).json({ error: 'Docker is not available', details: err.message });
    }
    res.status(500).json({ error: 'Failed to start app' });
  }
});

// POST /api/apps/:appId/stop - Stop a container
app.post('/api/apps/:appId/stop', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { appId } = req.params;

  try {
    const dockerResult = await dockerAction(appId, 'stop');
    const { data, error } = await supabase
      .from('docker_apps')
      .update({ status: 'stopped' })
      .eq('id', appId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) throw error;
    await logAudit(userId, 'app:stop', 'app', appId);
    res.json({ ...data, docker: dockerResult });
  } catch (err: any) {
    if (err.message?.includes('App not found') || err.message?.includes('No container')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message?.includes('docker') || err.code === 'ENOENT') {
      return res.status(502).json({ error: 'Docker is not available', details: err.message });
    }
    res.status(500).json({ error: 'Failed to stop app' });
  }
});

// POST /api/apps/:appId/restart - Restart a container
app.post('/api/apps/:appId/restart', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { appId } = req.params;

  try {
    const dockerResult = await dockerAction(appId, 'restart');
    const { data, error } = await supabase
      .from('docker_apps')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', appId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) throw error;
    await logAudit(userId, 'app:restart', 'app', appId);
    res.json({ ...data, docker: dockerResult });
  } catch (err: any) {
    if (err.message?.includes('App not found') || err.message?.includes('No container')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message?.includes('docker') || err.code === 'ENOENT') {
      return res.status(502).json({ error: 'Docker is not available', details: err.message });
    }
    res.status(500).json({ error: 'Failed to restart app' });
  }
});

// GET /api/apps/:appId/logs - Stream logs (paginated)
app.get('/api/apps/:appId/logs', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { appId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    // Verify app ownership
    const { data: app, error: appError } = await supabase
      .from('docker_apps')
      .select('id')
      .eq('id', appId)
      .eq('user_id', userId)
      .single();

    if (appError || !app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Fetch logs
    const { data, error } = await supabase
      .from('app_logs')
      .select('*')
      .eq('app_id', appId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ============================================================================
// USER ROUTES (require auth)
// ============================================================================

// GET /api/user - Get current user info
app.get('/api/user', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json({
      id: (req as any).user.id,
      email: (req as any).user.email,
      ...profile,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ============================================================================
// CONFIG ROUTES (require auth)
// ============================================================================

// GET /api/config/mode - Get current mode (personal/business)
app.get('/api/config/mode', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('setup_config')
      .select('mode')
      .single();

    if (error || !data) {
      return res.json({ mode: 'personal' });
    }

    res.json({ mode: data.mode });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// Health check with basic instrumentation exposure
app.get('/health', (req: Request, res: Response) => {
  // Return some useful health metrics for observability
  res.json({ status: 'ok', uptime: process.uptime(), version: APP_VERSION, metrics });
});

// GET /api/demo/flag - Expose the Demo feature flag for testing/CI verification
app.get('/api/demo/flag', (_req: Request, res: Response) => {
  const enabled = process.env.VITE_DEMO_FEATURE_ENABLED === 'true';
  res.json({ enabled });
});

// Minimal Business Mode MVP: expose a placeholder endpoint for customers
// Access controlled via existing verifyAuth middleware
app.get('/api/customers', verifyAuth, customersLimiter, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const { data: cfg } = await supabase.from('setup_config').select('mode').single();
    const mode = (cfg as any)?.mode || 'personal';
    if (mode === 'personal') {
      return res.status(403).json({ error: 'Not available in Personal Mode' });
    }
    // Seed data on first boot for this user if no customers exist yet
    const { data: existingForUser, error: ex } = await supabase
      .from('customers')
      .select('id')
      .eq('owner_user_id', userId)
      .limit(1);
      if (!existingForUser || existingForUser.length === 0) {
      try {
        const seedsPath = path.join(__dirname, '..', 'seeds', 'customers.sample.json');
        let seeds: Array<{ name: string; email?: string } > = [];
        try {
          const raw = await fs.readFile(seedsPath, 'utf8');
          seeds = JSON.parse(raw);
        } catch {
          // If seeds file missing or invalid, skip seeding
          seeds = [];
        }
        for (const s of seeds) {
          // Respect owner_user_id in seed data; skip if it doesn't belong to the current user
          if ((s as any).owner_user_id && (s as any).owner_user_id !== userId) continue;
          if (!s?.name) continue;
          const { data: exists, error: e2 } = await supabase
            .from('customers')
            .select('id')
            .eq('owner_user_id', userId)
            .eq('name', s.name)
            .limit(1);
          if (exists && exists.length > 0) continue;
          await supabase
            .from('customers')
            .insert({ owner_user_id: userId, name: s.name, email: s.email ?? null })
            .select()
            .single();
        }
      } catch {
        // Ignore seeding errors; UI can still function
      }
    }
    // After potential seeding, fetch and return
    const { data, error } = await supabase.from('customers').select('*').eq('owner_user_id', userId);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /api/customers - Create a new customer (Business Mode only)
app.post('/api/customers', verifyAuth, customersLimiter, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { name, email } = req.body;
  try {
    const { data: cfg } = await supabase.from('setup_config').select('mode').single();
    const mode = (cfg as any)?.mode || 'personal';
    if (mode === 'personal') {
      return res.status(403).json({ error: 'Not available in Personal Mode' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const { data, error } = await supabase.from('customers').insert({ owner_user_id: userId, name, email }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// POST /api/seed-demo - Seed demo data (customers + apps) for quick local demos
app.post('/api/seed-demo', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const { data: cfg } = await supabase.from('setup_config').select('mode').single();
    const mode = (cfg as any)?.mode || 'personal';
    if (mode === 'personal') {
      return res.status(403).json({ error: 'Not available in Personal Mode' });
    }

    const demoCustomers = [
      { owner_user_id: userId, name: 'Acme Co', email: 'contact@acme.local' },
      { owner_user_id: userId, name: 'Globex Corp', email: 'hello@globex.local' },
    ];
    // Idempotent: seed only missing customers for this user
    let insertedCustomers: any[] = [];
    for (const dc of demoCustomers) {
      const { data: exists } = await supabase
        .from('customers')
        .select('id')
        .eq('owner_user_id', userId)
        .eq('name', dc.name)
        .single();
      if (!exists) {
        const { data } = await supabase.from('customers').insert({ owner_user_id: userId, name: dc.name, email: dc.email }).select().single();
        if (data) insertedCustomers.push(data);
      }
    }
    // Prepare apps for seed (optional). Keep this idempotent per owner+name so
    // repeated demo seeding does not create duplicate containers for the same user.
    const demoApps = [
      { user_id: userId, name: 'demo-app', image: 'nginx:latest', status: 'stopped', memory_limit: '256mb' },
      { user_id: userId, name: 'monitor', image: 'prom/prometheus', status: 'stopped', memory_limit: '256mb' },
    ];
    let insertedApps: any[] = [];
    for (const appSeed of demoApps) {
      const { data: exists } = await supabase
        .from('docker_apps')
        .select('id')
        .eq('user_id', userId)
        .eq('name', appSeed.name)
        .single();
      if (!exists) {
        const { data } = await supabase.from('docker_apps').insert(appSeed).select().single();
        if (data) insertedApps.push(data);
      }
    }

    const customersSeeded = Array.isArray(insertedCustomers) ? insertedCustomers.length : 0;
    const appsSeeded = Array.isArray(insertedApps) ? insertedApps.length : 0;
    res.json({ customersSeeded, appsSeeded });
  } catch (err) {
    res.status(500).json({ error: 'Seed-demo failed' });
  }
});

// PATCH /api/customers/:customerId - Update a customer (Business Mode only)
app.patch('/api/customers/:customerId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { customerId } = req.params;
  const updates = req.body;
  try {
    // Ensure ownership and apply updates
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .eq('owner_user_id', userId)
      .select()
      .single();
    if (error || !data) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /api/customers/:customerId - Delete a customer (Business Mode only)
app.delete('/api/customers/:customerId', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { customerId } = req.params;
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)
      .eq('owner_user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// ============================================================================
// Phase 4: Management Panel Routes
// ============================================================================

// GET /api/apps/:appId/metrics - Server metrics for an app
app.get('/api/apps/:appId/metrics', verifyAuth, async (req: Request, res: Response) => {
  const { appId } = req.params;
  const range = (req.query.range as string) || '30m';
  try {
    const since = new Date(Date.now() - parseRange(range)).toISOString();
    const { data, error } = await supabase
      .from('server_metrics')
      .select('*')
      .eq('app_id', appId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

function parseRange(range: string): number {
  const match = range.match(/^(\d+)([mhd])$/);
  if (!match) return 30 * 60 * 1000;
  const val = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 3600 * 1000;
  if (unit === 'd') return val * 86400 * 1000;
  return 30 * 60 * 1000;
}

// GET /api/metrics/aggregated - Aggregated metrics across all apps
app.get('/api/metrics/aggregated', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const { data: apps } = await supabase.from('docker_apps').select('id').eq('user_id', userId);
    if (!apps || apps.length === 0) return res.json({ totalApps: 0, totalPlayers: 0, avgCpu: 0, avgMemory: 0, serverCount: 0 });

    const appIds = apps.map(a => a.id);
    const { data: metrics } = await supabase
      .from('server_metrics')
      .select('app_id, player_count, cpu_percent, memory_used_mb, memory_total_mb, tps, lag_spike')
      .in('app_id', appIds)
      .order('recorded_at', { ascending: false });

    if (!metrics) return res.json({ totalApps: apps.length, totalPlayers: 0, avgCpu: 0, avgMemory: 0, serverCount: 0 });

    const latest = new Map<string, any>();
    for (const m of metrics) {
      if (!latest.has(m.app_id)) latest.set(m.app_id, m);
    }

    const vals = Array.from(latest.values());
    const totalPlayers = vals.reduce((s, m) => s + (m.player_count || 0), 0);
    const avgCpu = vals.length > 0 ? vals.reduce((s, m) => s + (m.cpu_percent || 0), 0) / vals.length : 0;
    const avgMemoryPercent = vals.length > 0
      ? vals.reduce((s, m) => s + (m.memory_total_mb > 0 ? ((m.memory_used_mb || 0) / m.memory_total_mb) * 100 : 0), 0) / vals.length
      : 0;
    const lagCount = vals.filter(m => m.lag_spike).length;
    res.json({ totalApps: apps.length, totalPlayers, avgCpu: Math.round(avgCpu * 100) / 100, avgMemory: Math.round(avgMemoryPercent * 100) / 100, serverCount: apps.length, lagSpikes: lagCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch aggregated metrics' });
  }
});

// GET /api/logs/access - Access logs
app.get('/api/logs/access', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
  const offset = parseInt(req.query.offset as string) || 0;
  try {
    const { data, error } = await supabase
      .from('access_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch access logs' });
  }
});

// GET /api/apps/:appId/config-versions - Config version history
app.get('/api/apps/:appId/config-versions', verifyAuth, async (req: Request, res: Response) => {
  const { appId } = req.params;
  try {
    const { data, error } = await supabase
      .from('config_versions')
      .select('*')
      .eq('app_id', appId)
      .order('version', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config versions' });
  }
});

// POST /api/apps/:appId/config-versions - Create config version snapshot
app.post('/api/apps/:appId/config-versions', verifyAuth, async (req: Request, res: Response) => {
  const { appId } = req.params;
  const userId = (req as any).user.id;
  const { config_snapshot, change_summary } = req.body;
  try {
    const { data: maxVer } = await supabase
      .from('config_versions')
      .select('version')
      .eq('app_id', appId)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion = (maxVer && maxVer.length > 0 ? maxVer[0].version : 0) + 1;
    const { data, error } = await supabase
      .from('config_versions')
      .insert({ app_id: appId, version: nextVersion, config_snapshot, created_by: userId, change_summary })
      .select()
      .single();
    if (error) throw error;
    await logAudit(userId, 'config:version:create', 'config_version', `${appId}@v${nextVersion}`, null, { change_summary });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create config version' });
  }
});

// POST /api/apps/:appId/config-versions/:version/rollback - Rollback to version
app.post('/api/apps/:appId/config-versions/:version/rollback', verifyAuth, async (req: Request, res: Response) => {
  const { appId, version } = req.params;
  const userId = (req as any).user.id;
  try {
    const { data: target, error: fetchError } = await supabase
      .from('config_versions')
      .select('*')
      .eq('app_id', appId)
      .eq('version', parseInt(version))
      .single();
    if (fetchError || !target) return res.status(404).json({ error: 'Version not found' });
    const snapshot = target.config_snapshot;
    // Update the app with the snapshot config
    const { data, error } = await supabase
      .from('docker_apps')
      .update({ environment_vars: snapshot.environment_vars || {}, memory_limit: snapshot.memory_limit, cpu_shares: snapshot.cpu_shares })
      .eq('id', appId)
      .select()
      .single();
    if (error) throw error;
    // Create a new version entry reflecting the rollback
    const { data: maxVer } = await supabase
      .from('config_versions')
      .select('version')
      .eq('app_id', appId)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion = (maxVer && maxVer.length > 0 ? maxVer[0].version : 0) + 1;
    const { data: newVer, error: verError } = await supabase
      .from('config_versions')
      .insert({ app_id: appId, version: nextVersion, config_snapshot: snapshot, created_by: userId, change_summary: `Rolled back to version ${version}` })
      .select()
      .single();
    if (verError) throw verError;
    await logAudit(userId, 'config:rollback', 'config_version', `${appId}@v${version}`, null, { rolled_back_to: version });
    res.json(newVer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to rollback config' });
  }
});

// Maintenance Windows CRUD
app.get('/api/maintenance-windows', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const { data, error } = await supabase
      .from('maintenance_windows')
      .select('*')
      .eq('user_id', userId)
      .order('starts_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch maintenance windows' });
  }
});

app.post('/api/maintenance-windows', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { title, description, app_id, starts_at, ends_at } = req.body;
  try {
    const { data, error } = await supabase
      .from('maintenance_windows')
      .insert({ user_id: userId, title, description, app_id, starts_at, ends_at })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create maintenance window' });
  }
});

app.patch('/api/maintenance-windows/:id', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('maintenance_windows')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Maintenance window not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update maintenance window' });
  }
});

// Backup Jobs CRUD
app.get('/api/backup-jobs', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const { data, error } = await supabase
      .from('backup_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch backup jobs' });
  }
});

app.post('/api/backup-jobs', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, app_id, schedule_type, retention_count } = req.body;
  try {
    const { data, error } = await supabase
      .from('backup_jobs')
      .insert({ user_id: userId, name, app_id, schedule_type: schedule_type || 'manual', retention_count: retention_count || 7 })
      .select()
      .single();
    if (error) throw error;
    await logAudit(userId, 'backup:create', 'backup', data.id, null, { name, app_id });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create backup job' });
  }
});

app.patch('/api/backup-jobs/:id', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('backup_jobs')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Backup job not found' });
    await logAudit(userId, 'backup:update', 'backup', id, null, req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update backup job' });
  }
});

app.delete('/api/backup-jobs/:id', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { error } = await supabase.from('backup_jobs').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    await logAudit(userId, 'backup:delete', 'backup', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete backup job' });
  }
});

// GET /api/backup-jobs/:jobId/status - Backup status history
app.get('/api/backup-jobs/:jobId/status', verifyAuth, async (req: Request, res: Response) => {
  const { jobId } = req.params;
  try {
    const { data, error } = await supabase
      .from('backup_status')
      .select('*')
      .eq('backup_job_id', jobId)
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch backup status' });
  }
});

// Alert Configs CRUD
app.get('/api/alert-configs', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const { data, error } = await supabase
      .from('alert_configs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alert configs' });
  }
});

app.post('/api/alert-configs', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { metric_type, operator, threshold, enabled, notify_email } = req.body;
  try {
    const { data, error } = await supabase
      .from('alert_configs')
      .insert({ user_id: userId, metric_type, operator, threshold, enabled: enabled ?? true, notify_email: notify_email ?? false })
      .select()
      .single();
    if (error) throw error;
    await logAudit(userId, 'alert:create', 'alert_config', data.id, null, { metric_type, operator, threshold });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create alert config' });
  }
});

app.patch('/api/alert-configs/:id', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('alert_configs')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Alert config not found' });
    await logAudit(userId, 'alert:update', 'alert_config', id, null, req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert config' });
  }
});

app.delete('/api/alert-configs/:id', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { error } = await supabase.from('alert_configs').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    await logAudit(userId, 'alert:delete', 'alert_config', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete alert config' });
  }
});

// Alert History
app.get('/api/alert-history', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const { data: configs } = await supabase.from('alert_configs').select('id').eq('user_id', userId);
    if (!configs || configs.length === 0) return res.json([]);
    const configIds = configs.map(c => c.id);
    const { data, error } = await supabase
      .from('alert_history')
      .select('*')
      .in('alert_config_id', configIds)
      .order('triggered_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

app.post('/api/alert-history/:id/acknowledge', verifyAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('alert_history')
      .update({ acknowledged: true })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Alert not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Health Checks
app.get('/api/health-checks', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const appId = req.query.app_id as string;
  try {
    let query = supabase.from('health_checks').select('*, docker_apps!inner(user_id)').eq('docker_apps.user_id', userId);
    if (appId) query = query.eq('app_id', appId);
    const { data, error } = await query.order('checked_at', { ascending: false }).limit(200);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health checks' });
  }
});

// Reports & Export
app.get('/api/reports', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  try {
    const { data: apps } = await supabase.from('docker_apps').select('id').eq('user_id', userId);
    if (!apps || apps.length === 0) return res.json({ metrics: [], backups: [], alerts: [] });

    const appIds = apps.map(a => a.id);
    const since = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
    const until = endDate || new Date().toISOString();

    const [metricsRes, backupsRes, alertsRes] = await Promise.all([
      supabase.from('server_metrics').select('*').in('app_id', appIds).gte('recorded_at', since).lte('recorded_at', until).order('recorded_at', { ascending: false }).limit(500),
      supabase.from('backup_status').select('*, backup_jobs!inner(app_id)').in('backup_jobs.app_id', appIds).gte('started_at', since).lte('started_at', until).order('started_at', { ascending: false }).limit(500),
      supabase.from('alert_history').select('*').gte('triggered_at', since).lte('triggered_at', until).order('triggered_at', { ascending: false }).limit(500),
    ]);

    res.json({
      metrics: metricsRes.data || [],
      backups: backupsRes.data || [],
      alerts: alertsRes.data || [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

app.get('/api/reports/export', verifyAuth, async (req: Request, res: Response) => {
  const format = req.query.format as string;
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    res.send('metric,value,timestamp\nCPU,23,2024-01-01\nMemory,45,2024-01-01');
  } else {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
    res.send(Buffer.from('PDF placeholder'));
  }
});

// ============================================================================
// AUDIT LOG ROUTE
// ============================================================================

app.get('/api/audit-log', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const { user_id, entity_type, action, start_date, end_date } = req.query;

  try {
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (entity_type && typeof entity_type === 'string') query = query.eq('entity_type', entity_type);
    if (action && typeof action === 'string') query = query.eq('action', action);
    if (start_date && typeof start_date === 'string') query = query.gte('created_at', start_date);
    if (end_date && typeof end_date === 'string') query = query.lte('created_at', end_date);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ data: data || [], total: count, limit, offset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

app.get('/api/search', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const q = req.query.q as string;
  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    const searchPattern = `%${q}%`;
    const [apps, auditLogs, backups] = await Promise.all([
      supabase
        .from('docker_apps')
        .select('id, name')
        .eq('user_id', userId)
        .or(`name.ilike.${searchPattern},description.ilike.${searchPattern},image.ilike.${searchPattern}`)
        .limit(10),
      supabase
        .from('audit_log')
        .select('id, action')
        .eq('user_id', userId)
        .ilike('action', searchPattern)
        .limit(10),
      supabase
        .from('backup_jobs')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', searchPattern)
        .limit(10),
    ]);

    res.json({
      results: [
        ...(apps.data || []).map((a: any) => ({ id: a.id, name: a.name, type: 'app' })),
        ...(auditLogs.data || []).map((a: any) => ({ id: a.id, name: a.action, type: 'audit' })),
        ...(backups.data || []).map((b: any) => ({ id: b.id, name: b.name, type: 'backup' })),
      ],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search' });
  }
});

// ============================================================================
// NOTIFICATION CHANNELS ROUTES
// ============================================================================

app.get('/api/notification-channels', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const { data, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notification channels' });
  }
});

app.post('/api/notification-channels', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { name, type, config } = req.body;
  if (!name || !type || !config) {
    return res.status(400).json({ error: 'name, type, and config are required' });
  }
  if (!['email', 'webhook', 'telegram'].includes(type)) {
    return res.status(400).json({ error: 'type must be email, webhook, or telegram' });
  }
  try {
    const { data, error } = await supabase
      .from('notification_channels')
      .insert({ user_id: userId, name, type, config })
      .select()
      .single();
    if (error) throw error;
    await logAudit(userId, 'notification:create', 'notification_channel', data.id, null, { name, type });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create notification channel' });
  }
});

app.patch('/api/notification-channels/:id', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('notification_channels')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Notification channel not found' });
    await logAudit(userId, 'notification:update', 'notification_channel', id, null, req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification channel' });
  }
});

app.delete('/api/notification-channels/:id', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('notification_channels')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    await logAudit(userId, 'notification:delete', 'notification_channel', id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification channel' });
  }
});

app.post('/api/notification-channels/:id/test', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  try {
    const { data: channel, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (error || !channel) return res.status(404).json({ error: 'Notification channel not found' });
    res.json({ success: true, message: `Test notification sent via ${channel.type}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// ============================================================================
// OPENAPI / SWAGGER DOCS
// ============================================================================

app.get('/api/openapi.json', (_req: Request, res: Response) => {
  res.json(openapiSpec);
});

app.get('/api/docs', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Infra Pilot API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });
</script>
</body></html>`);
});

// ============================================================================
// START SERVER
// ============================================================================

const httpServer = http.createServer(app);

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const appId = url.searchParams.get('appId');
  if (!appId) { ws.close(); return; }

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'subscribe' && msg.appId) {
        const logStream = spawn('docker', ['logs', '--tail', '100', '-f', msg.appId]);
        logStream.stdout.on('data', (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'log', appId: msg.appId, data: chunk.toString() }));
          }
        });
        logStream.on('close', () => {
          ws.send(JSON.stringify({ type: 'log_end', appId: msg.appId }));
        });
        ws.on('close', () => { logStream.kill(); });
      }
      if (msg.type === 'subscribe:metrics' && msg.appId) {
        const interval = setInterval(async () => {
          try {
            const { stdout } = await execAsync(`docker stats ${msg.appId} --no-stream --format "{{json .}}"`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'metrics', appId: msg.appId, data: JSON.parse(stdout) }));
            }
          } catch {}
        }, 2000);
        ws.on('close', () => clearInterval(interval));
      }
    } catch {}
  });
});

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(port, () => {
    console.log(`✨ Docker Panel API running on http://localhost:${port}`);
    console.log(`📡 Frontend should be at http://localhost:5173`);
    console.log(`🐳 Make sure Supabase and Docker are configured in .env.local`);
  });
}
