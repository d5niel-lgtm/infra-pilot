# Docker Panel - Mode Architecture

## Overview

Docker Panel supports two distinct operation modes:

1. **Personal Mode** (default) - Simple self-hosted Docker container management
2. **Hosting Business Mode** - Full-featured hosting control panel with customer management, billing, and white-label options

The mode is selected during initial setup and controls which features are available throughout the application.

## Mode Selection & Initialization

### First-Time Setup

When the panel is first accessed, users see the **Setup Wizard**:

```
Step 1: Mode Selection
├─ 🏠 Personal Mode (default, recommended)
│   └─ Simple Docker app management for self-hosters
└─ 🚀 Hosting Business Mode
    └─ Full-featured hosting control panel

Step 2: Create Admin Account
├─ Display Name
├─ Email
├─ Password
└─ Mode confirmation (from Step 1)
```

Database: The selected mode is stored in `setup_config.mode` and `user_profiles.mode_at_signup`.

### After Setup

Subsequent logins display the panel based on the configured mode. Settings may allow mode switching (future enhancement).

---

## Personal Mode Features

**Focused on individual self-hosters and hobby projects**

### Core Features
- ✅ Docker app creation and management
- ✅ Port mapping and environment variables
- ✅ Volume/mount configuration
- ✅ Start/stop/restart controls
- ✅ Logs streaming (paginated)
- ✅ Basic container status monitoring
- ✅ Simple admin account management
- ✅ Basic settings and configuration

### Hidden Features
- ❌ Customer account management
- ❌ Plans and pricing
- ❌ Billing integration
- ❌ White-label options
- ❌ Team/staff roles
- ❌ Resource quotas (per-customer)
- ❌ Audit logs (business context)
- ❌ Advanced multi-user RBAC

### UI/UX
- Minimal, focused navigation
- "Docker Panel" branding
- Simple dashboard with app list
- Single-user perspective
- Settings are personal, not organizational

---

## Hosting Business Mode Features

**Full hosting control panel for managing multiple customers**

### Core Features (from Personal Mode)
- ✅ All Personal Mode features
- ✅ Docker infrastructure abstraction

### Business-Specific Features
- ✅ Customer account creation and management
- ✅ Plans and pricing tiers
- ✅ Resource quotas per customer
- ✅ Billing integration hooks (placeholder)
- ✅ White-label and branding customization
- ✅ Team and staff role management
- ✅ Audit logs for compliance
- ✅ Advanced RBAC (admin, staff, customer)
- ✅ Customer onboarding workflows
- ✅ Dashboard with business analytics

### UI/UX
- Expanded navigation with business features
- Customizable branding
- Multi-user and team management
- Customer management interface
- Advanced settings and configurations

---

## Feature Gates Implementation

### Architecture

Feature availability is controlled via the `featureGates` utility in `lib/types.ts`:

```typescript
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
```

### Usage in Components

```tsx
import { useConfig } from '../lib/types';
import { featureGates } from '../lib/types';

export const SettingsPage = () => {
  const { mode } = useConfig();
  
  if (!featureGates.canViewAuditLogs(mode)) {
    return <p>This feature is only available in Hosting Business Mode</p>;
  }
  
  return <AuditLogsSection />;
};
```

### Usage in Backend Routes

```typescript
// In server/index.ts
app.get('/api/customers', verifyAuth, async (req, res) => {
  const config = await getSetupConfig();
  
  if (!config || config.mode !== 'business') {
    return res.status(403).json({ error: 'Not available in Personal Mode' });
  }
  
  // Return customers...
});
```

---

## Database Schema - Mode Segregation

### Shared Tables (All Modes)
- `user_profiles` - User account info and roles
- `docker_apps` - Docker applications and containers
- `app_logs` - Application logs
- `setup_config` - Mode and initialization state

### Business Mode Tables (TODO)
- `customers` - Customer accounts
- `plans` - Pricing plans
- `resource_quotas` - Per-customer resource limits
- `billing_events` - Billing transactions
- `audit_logs` - Operational audit trail
- `team_members` - Staff and administrators
- `branding_config` - White-label settings

### Multi-Tenancy Consideration

In Personal Mode, all `docker_apps` belong to a single admin user.

In Business Mode (future), `docker_apps` can be scoped to customers:
```sql
ALTER TABLE docker_apps ADD COLUMN customer_id UUID REFERENCES customers(id);
```

---

## Environment Variable Configuration

### Development Setup

Create `.env.local` based on `.env.local.example`:

```
# Supabase
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# API Backend
VITE_API_URL=http://localhost:3001

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
```

### Production Configuration

Suggested environment variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=<production-key>
VITE_API_URL=https://api.yourdomain.com
DOCKER_HOST=tcp://docker-daemon:2375
NODE_ENV=production
```

---

## Data Flow: Setup Initialization

```
User arrives at /
    ↓
checkSetupStatus() → setup_config table
    ↓
If NOT initialized:
├─ Show Setup Wizard
├─ Collect mode + admin credentials
└─ POST /api/setup/init
    ├─ Create auth.users entry (Supabase Auth)
    ├─ Create user_profiles row (admin user)
    └─ Create setup_config row (mode)
        ↓
        Return session JWT
    ↓
Store token in localStorage
Set ConfigContext.mode
Redirect to Dashboard

If initialized:
├─ Check localStorage for session token
├─ Set ConfigContext.mode from setup_config
└─ Render Dashboard with feature gates
```

---

## Data Flow: Feature Access

```
Component renders
    ↓
useConfig() → { mode, loading }
    ↓
featureGates.someFeature(mode)
    ↓
If gate is false:
├─ Hide/disable feature
└─ Show "Not available in [mode]" message

If gate is true:
├─ Render feature
└─ API call proceeds if authorized
```

---

## Migration Path: Personal → Business (Future)

If a user wants to upgrade Personal Mode to Business Mode:

1. **Admin flag in UI**: "Upgrade to Business Mode" button (disabled/hidden in first release)
2. **Data migration**: Run migration script to:
   - Create business mode tables
   - Map existing admin user to a staff member
   - Create default plan for existing docker_apps
   - Initial audit log entries
3. **Mode flag update**: `UPDATE setup_config SET mode = 'business'`
4. **Redirect**: Refresh UI to show new business features

Implementation deferred to Phase 2.

---

## Testing the Modes

### Personal Mode Test Scenario
1. Start fresh setup
2. Select "Personal Mode"
3. Create admin account
4. Create a Docker app
5. Verify business features are hidden
6. Verify docker app CRUD works

### Business Mode Test Scenario
1. Start fresh setup
2. Select "Hosting Business Mode"
3. Create admin account
4. Verify business feature placeholders appear (TODO)
5. Verify docker app CRUD still works

---

## Security Considerations

### Row-Level Security (RLS)

All tables use Supabase RLS policies to ensure:
- Users can only see their own docker_apps
- Users can only see their own user_profile
- In Business Mode (future): Customers see only their owned resources

### Authentication

- Supabase Auth handles user authentication (email + password)
- JWT token stored in localStorage
- Token passed in `Authorization: Bearer <token>` header
- Backend validates token on every API call

### Mode-Based Access Control

- Feature gates prevent unauthorized UI rendering
- Backend API routes check mode before returning data
- Business features return 403 Forbidden if mode is personal

---

## Roadmap

### Phase 1 (Current)
- ✅ Personal Mode fully functional
- ✅ Setup wizard with mode selection
- ✅ Docker app CRUD
- ✅ Basic logs and controls
- ✅ Feature gate framework

### Phase 2 (Business Mode MVP)
- ⏳ Customer management UI
- ⏳ Plans and pricing configuration
- ⏳ Billing integration hooks
- ⏳ Audit logging
- ⏳ Team/staff management

### Phase 3 (Advanced Business)
- ⏳ White-label branding
- ⏳ Advanced RBAC
- ⏳ Multi-region deployment
- ⏳ Advanced analytics dashboard

---

## FAQ

**Q: Can I switch from Personal to Business Mode later?**
A: Yes (planned for Phase 2). Your docker_apps and user data will be preserved.

**Q: Does Personal Mode limit me to one server?**
A: No. Personal Mode supports unlimited docker_apps on one (or multiple) servers. It's just a single-user panel without business/customer management.

**Q: Where is the business mode code?**
A: Business mode tables and routes are stubbed in the database schema. Routes return `{ error: 'Not available in Personal Mode' }` for now. Full implementation is Phase 2.

**Q: How does authentication work?**
A: Supabase Auth (email/password) creates the user account. A JWT is issued and stored locally. The API validates the token on each request.

**Q: Can I make my own custom feature gates?**
A: Yes. Add new gates to `lib/types.ts` featureGates object. Use them in components with `featureGates.yourNewGate(mode)`.
