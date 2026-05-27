import { createContext, useContext } from 'react';

export type SetupMode = 'personal' | 'business';

export interface SetupStatus {
  initialized: boolean;
  mode: SetupMode | null;
}

export interface DockerApp {
  id: string;
  user_id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting' | 'error';
  container_id?: string;
  ports?: Array<{ hostPort: number; containerPort: number; protocol: string }>;
  environment_vars?: Record<string, string>;
  volumes?: Array<{ hostPath: string; containerPath: string }>;
  restart_policy?: string;
  memory_limit?: string;
  cpu_shares?: number;
  description?: string;
  labels?: Record<string, string>;
  javaVersion?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  role: 'admin' | 'user';
  mode_at_signup: SetupMode;
}

export interface AppConfig {
  mode: SetupMode;
}

export interface Customer {
  id: string;
  owner_user_id: string;
  name: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

// Feature gates based on mode
export const featureGates = {
  isPersonal: (mode: SetupMode) => mode === 'personal',
  isBusiness: (mode: SetupMode) => mode === 'business',
  
  // Personal mode features (always available)
  canManageLocalApps: (mode: SetupMode) => true,
  canViewLogs: (mode: SetupMode) => true,
  canConfigureEnv: (mode: SetupMode) => true,
  
  // Business mode features
  canManageCustomers: (mode: SetupMode) => mode === 'business',
  canManagePlans: (mode: SetupMode) => mode === 'business',
  canViewBilling: (mode: SetupMode) => mode === 'business',
  canWhitelabel: (mode: SetupMode) => mode === 'business',
  canManageTeam: (mode: SetupMode) => mode === 'business',
  canViewAuditLogs: (mode: SetupMode) => mode === 'business',
  canConfigureHosting: (mode: SetupMode) => mode === 'business',
};

// Config context for global access to mode
export const ConfigContext = createContext<{ mode: SetupMode; loading: boolean }>({
  mode: 'personal',
  loading: true,
});

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};


export interface ServerPreset {
  id: string;
  name: string;
  description: string;
  image: string;
  startupCommand: string;
  resources: {
    ram: string;
    cpu: number;
    disk: string;
  };
  ports: Array<{ hostPort: number; containerPort: number; protocol: 'tcp' | 'udp' }>;
  environmentVars: Record<string, string>;
  javaVersion?: string;
}

export const JAVA_VERSIONS = ['8', '11', '17', '21'] as const;

// ============================================================================
// Phase 4 Types
// ============================================================================

export interface ServerMetric {
  id: number;
  app_id: string;
  tps: number | null;
  player_count: number;
  memory_used_mb: number;
  memory_total_mb: number;
  cpu_percent: number;
  world_size_mb: number;
  lag_spike: boolean;
  recorded_at: string;
}

export interface AccessLog {
  id: number;
  user_id: string;
  action: string;
  source_ip: string;
  status: 'success' | 'failed' | 'pending';
  details: string;
  created_at: string;
}

export interface ConfigVersion {
  id: number;
  app_id: string;
  version: number;
  config_snapshot: Record<string, any>;
  created_by: string;
  change_summary: string;
  created_at: string;
}

export interface MaintenanceWindow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  app_id: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface BackupJob {
  id: string;
  user_id: string;
  app_id: string;
  name: string;
  schedule_type: 'manual' | 'hourly' | 'daily' | 'weekly';
  retention_count: number;
  next_run: string;
  last_run: string;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
}

export interface BackupStatusEntry {
  id: number;
  backup_job_id: string;
  status: 'running' | 'success' | 'failed';
  size_mb: number;
  error_message: string;
  started_at: string;
  completed_at: string;
}

export interface AlertConfig {
  id: string;
  user_id: string;
  metric_type: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  enabled: boolean;
  notify_email: boolean;
  created_at: string;
}

export interface AlertHistoryEntry {
  id: number;
  alert_config_id: string;
  metric_type: string;
  metric_value: number;
  threshold: number;
  operator: string;
  triggered_at: string;
  acknowledged: boolean;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  taskType: 'restart' | 'command' | 'backup' | 'custom';
  targetAppId?: string;
  cronExpression: string;
  command?: string;
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  nextRunAt?: string;
  createdAt: string;
}

export interface BillingInfo {
  balance: number;
  totalSpent: number;
  totalToppedUp: number;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: 'topup' | 'charge' | 'refund' | 'bonus';
  balanceAfter: number;
  timestamp: string;
}

export interface BillingRates {
  cpuPerCoreHour: number;
  ramPerGbHour: number;
  storagePerGbHour: number;
  backupPerGb: number;
}

export interface CostEstimate {
  hourly: number;
  daily: number;
  monthly: number;
}

export interface HealthCheck {
  id: number;
  app_id: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  response_time_ms: number;
  details: Record<string, any>;
  checked_at: string;
}

// ============================================================================
// Config Editor Types
// ============================================================================

export interface ConfigFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
}

export interface ConfigFileContent {
  content: string;
  path: string;
  language: 'yaml' | 'json' | 'properties' | 'text';
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Modpack {
  id: string;
  name: string;
  platform: 'curseforge' | 'modrinth';
  summary: string;
  downloads: number;
  iconUrl?: string;
  minecraftVersions: string[];
  loaders: string[];
  url: string;
}

export interface ModpackInstallation {
  id: string;
  modpackId: string;
  appId: string;
  status: 'pending' | 'downloading' | 'installing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: string;
}

export interface Database {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  appId?: string;
  status: 'running' | 'stopped' | 'creating';
  createdAt: string;
}

export interface GitDeployment {
  id: string;
  name: string;
  repoUrl: string;
  repo: string;
  branch: string;
  containerId?: string;
  targetDir: string;
  installCommand?: string;
  restartCommand?: string;
  enabled: boolean;
  webhookSecret: string;
  createdAt: string;
  history: DeploymentEvent[];
}

export interface DeploymentEvent {
  deploymentId: string;
  status: 'success' | 'failed' | 'timeout';
  commits: number;
  timestamp: string;
  error?: string;
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  authorName?: string;
  created_at: string;
  updated_at: string;
  published: boolean;
  resourceLinks?: string[];
}

export interface KBCategory {
  id: string;
  name: string;
  parentId?: string;
  description?: string;
  articleCount?: number;
}

// ============================================================================
// Activity Feed Types
// ============================================================================

export type ActivityEventType =
  | 'app:create' | 'app:update' | 'app:delete'
  | 'app:start' | 'app:stop' | 'app:restart'
  | 'backup:create' | 'backup:update' | 'backup:delete'
  | 'config:update' | 'deployment' | 'alert'
  | 'maintenance' | 'user:login' | 'user:logout'
  | 'database:create' | 'database:delete'
  | 'knowledge_base:create' | 'knowledge_base:update' | 'knowledge_base:delete';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  userId: string;
  userName?: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Dashboard Builder Types
// ============================================================================

export type PanelType = 'time-series' | 'stat' | 'log-list' | 'alert-list';

export interface PanelDataSource {
  type: 'metrics' | 'logs' | 'alerts' | 'backups' | 'apps';
  query?: string;
  aggregation?: string;
  period?: string;
}

export interface DashboardPanel {
  id: string;
  type: PanelType;
  title: string;
  dataSource: PanelDataSource;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
}

export interface DashboardDefinition {
  id: string;
  name: string;
  description?: string;
  panels: DashboardPanel[];
  layout: { columns: number; rowHeight: number };
  refreshInterval: number;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AI Config Advisor Types
// ============================================================================

export interface ConfigAdviceSuggestion {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  file?: string;
  line?: number;
  currentValue?: string;
  suggestedValue?: string;
  autoFixable: boolean;
  fixCommand?: string;
}

export interface ConfigAdviceResult {
  appId: string;
  analyzedAt: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  suggestions: ConfigAdviceSuggestion[];
}

// ============================================================================
// Plugin Marketplace Types
// ============================================================================

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  downloads: number;
  iconUrl?: string;
  readmeUrl?: string;
  homepage?: string;
  createdAt: string;
  updatedAt: string;
  installed: boolean;
  installedVersion?: string;
  installedAt?: string;
  appId?: string;
}

export interface PluginPublishData {
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  iconUrl?: string;
  homepage?: string;
}

// ============================================================================
// Collaborative Terminal Types
// ============================================================================

export interface TerminalSession {
  id: string;
  appId: string;
  createdBy: string;
  createdAt: string;
  users: TerminalUser[];
}

export interface TerminalUser {
  id: string;
  displayName: string;
  cursor?: { row: number; col: number };
  joinedAt: string;
}

// ============================================================================
// Change Approval Types
// ============================================================================

export interface ChangeRequest {
  id: string;
  userId: string;
  userName: string;
  appId: string;
  action: string;
  reason: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected' | 'emergency';
  reviewerId?: string;
  reviewerName?: string;
  rejectReason?: string;
  createdAt: string;
  reviewedAt?: string;
  expiresAt: string;
  isBreakGlass: boolean;
}

export interface ChangeRequestInput {
  appId: string;
  action: string;
  reason: string;
  details: string;
  isBreakGlass?: boolean;
}
