# 🐳 Docker Panel

**Self-hosted Docker container management panel** with Personal Mode for individual users and optional Hosting Business Mode.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-brightgreen?logo=node.js)](https://nodejs.org/)

## 🎯 Overview

**Docker Panel** is a Pterodactyl-inspired web panel for managing Docker containers locally. Perfect for self-hosters, hobby projects, and home labs.

### ✨ Personal Mode (Default)
- 🐳 **Docker App Management** - Create, deploy, and manage containerized applications
- 🎛️ **Container Controls** - Start/stop/restart via real Docker API calls
- 📊 **Dashboard** - Real-time status and metrics with live WebSocket updates
- 🔍 **Logs & Monitoring** - Stream application logs via WebSocket in real-time
- ⚙️ **Configuration** - Port mapping, environment variables, volume mounts
- 🔐 **Simple Auth** - Single admin account with rate-limited login
- 📋 **Audit Trail** - Append-only log of all mutations with timeline viewer
- 🔎 **Global Search** - Cmd+K palette to search apps, backups, and audit logs
- 🖥️ **Web Terminal** - In-browser container shell via WebSocket + Docker exec
- 📬 **Notification Channels** - Email, webhook, and Telegram alert delivery
- 📱 **PWA Support** - Installable as desktop app with offline caching
- 🎉 **Onboarding Wizard** - Guided 5-step tour after first-time setup

### 🚀 Business Mode (Optional)
- ✅ All Personal Mode features +
- 👥 Customer account management
- 💰 Plans and pricing tiers
- 🏷️ White-label branding
- 👔 Team and staff management
- 📋 Audit logging (Business Mode extension)

---

## 🚀 Quick Start (3 Commands)

```bash
# 1. Get the code
cd services/management-panel

# 2. Setup environment
cp .env.local.example .env.local

# 3. Install and run
npm install && npm run dev
```

### Demo Feature Flag (per-env)

- Gate the Seed Demo UI behind a per-environment feature flag to avoid accidental usage in prod-like environments.
- Env var: `VITE_DEMO_FEATURE_ENABLED`
- Default: false (flag is off unless explicitly enabled)
- How to enable/disable:
  - Local development: set in your .env.local
    - Add: `VITE_DEMO_FEATURE_ENABLED=true`
  - Staging/QA: set to `true` to enable demo flows for testers, or `false` to hide in testing
  - Production: keep it `false` to avoid accidental seeds
- Verification:
  - Start frontend and check that the Seed Demo button appears only when the flag is enabled.
  - Click Seed Demo to see the confirmation modal before seeding.
- Notes:
- This flag gates only the UI; the backend seed endpoints remain available to programmatic use when needed and are still protected by Business Mode.

### QA Checklist (Gating Demo Per-Env)
- Development (VITE_DEMO_FEATURE_ENABLED=true)
  - Seed Demo button is visible on the Customers page in Business Mode.
  - Click Seed Demo to open the confirmation modal; confirm to seed.
  - Verify the UI shows a success toast with seeded counts and the Customers list refreshes.
  - Verify the Seed Demo action is not shown when the flag is off.
- Staging/QA (VITE_DEMO_FEATURE_ENABLED=true or false)
  - If true, perform the same checks as Development.
  - If false, Seed Demo button should be hidden; confirm gating works in this environment.
- Production (VITE_DEMO_FEATURE_ENABLED not set or false)
  - Seed Demo button must be hidden; UI should reflect no demo button.
  - Optional: try calling the API directly with a valid token and confirm backend blocks based on Business Mode as designed.
- Validation steps (end-to-end)
  - Start both frontend and backend, login as a Business Mode admin, navigate to Customers, ensure gating behavior matches env flag.
  - Seed Demo idempotence: verify re-clicking Seed Demo (when enabled) does not crash and either updates or leaves data idempotently.
- Troubleshooting
  - If Seed Demo button is missing, verify VITE_DEMO_FEATURE_ENABLED is set to true and the frontend is restarted to pick up the env var.
  - If Seed Demo still seeds in prod-like env, rebuild the frontend to ensure the flag is re-evaluated.

**Then open:** http://localhost:5173

**First-time setup will guide you through:**
1. Choose Personal Mode or Business Mode
2. Create admin account
3. Start managing Docker apps

---


## 🖥️ Native Desktop Shell (zero-native)

The panel can also run as a zero-native desktop app. The React/Vite UI is loaded into a native WebView, while the Express API remains the local backend on `http://127.0.0.1:3001`.

```bash
# Terminal 1: API
npm run dev:backend

# Terminal 2: native shell + Vite managed by zero-native
npm run desktop:dev -- -Dzero-native-path=/absolute/path/to/zero-native
```

Useful scripts:

- `npm run desktop:validate` validates `app.zon`.
- `npm run desktop:doctor` checks the host zero-native environment.
- `npm run desktop:package -- -Dzero-native-path=/absolute/path/to/zero-native` packages the built `dist/` assets.

See the repository guide at [`../../docs/desktop/zero-native-management-panel.md`](../../docs/desktop/zero-native-management-panel.md).

## 📚 Documentation

| Document | Topic |
|----------|-------|
| [Docker Panel Quick Start](README-DOCKER-PANEL.md) | Getting started guide |
| [Personal Mode Architecture](docs/PERSONAL_MODE.md) | Mode design & feature gates |
| [Database Setup Guide](docs/DATABASE_SETUP.md) | Supabase configuration |
| [System Architecture](docs/ARCHITECTURE.md) | Technical diagrams & flows |
| [Implementation Summary](IMPLEMENTATION_SUMMARY.md) | Complete overview |

---

## ⚡ Features at a Glance

### Personal Mode ✅
- Docker app CRUD (create, read, update, delete)
- Container start/stop/restart controls
- Real-time logs and status monitoring
- Environment variable configuration
- Port mapping (host ↔ container)
- Volume/mount management
- Memory and CPU limits
- Simple dashboard with app grid
- Server performance monitoring with real-time metrics (TPS, CPU, memory, player count)
- Health check dashboard with uptime tracking and incident timeline
- Backup job automation and scheduling with retention policies
- Access log viewer for authentication and console events
- Reports generation with CSV/PDF export
- Alert configuration (metric thresholds) and alert history
- Maintenance window scheduling
- Config version control with snapshot and rollback
- Config Editor — In-browser YAML/JSON config editor with syntax highlighting
- Java Version Selector — Switch between Java 8/11/17/21 per server
- MySQL Database per Click — Instant MySQL container provisioning
- Git Deployment Webhook — Auto-deploy on GitHub push
- Cronjob Scheduler — Scheduled tasks via cron expressions
- Real-time Resource Graphs — Live CPU/memory/disk gauges with sparklines
- Log Search — Full-text log search with filters and pagination
- Prepaid Billing — Pay-as-you-go balance system with transaction history
- Modpack-Installer — One-click modpack install from CurseForge/Modrinth
- 2FA (TOTP) — Two-factor authentication via TOTP
- Discord Token Validation — Validate bot token before container start

### Business Mode (Roadmap) 🔜
- Customer accounts and management
- Plans and pricing configuration
- Billing integration hooks
- White-label branding
- Team/staff RBAC
- Audit logging
- Advanced analytics

---

## 🏗️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + TypeScript | Modern, type-safe |
| Styling | Tailwind CSS | Utility-first, dark mode |
| Routing | React Router v6 | Industry standard |
| Backend | Express.js | Lightweight, async |
| Database | PostgreSQL + Supabase | Structured, RLS security |
| Auth | Supabase Auth | Built-in, scalable |

---

## 📂 Project Structure

```
services/management-panel/
├── src/
│   ├── pages/           # Setup, Dashboard, AppForm, AppDetail, Monitoring, AccessLogs, Backups, Reports, Settings, AuditLog, Billing
│   ├── components/      # MainLayout, Sidebar, NavBar, OnboardingWizard, GlobalSearch, WebTerminal, ConfigEditor, CronJobManager, DatabaseManager, GitDeployManager, RealtimeMetrics, MetricsConfig, BillingDashboard, ModpackBrowser, TwoFactorSetup, shared/monitoring/backup/alert components
│   ├── lib/             # API client, auth, types, feature gates
│   ├── App.tsx          # Main router and mode provider
│   ├── main.tsx         # React entry point (includes PWA service worker registration)
│   └── ThemeToggle.tsx  # Dark/light mode with localStorage persistence
├── server/
│   ├── index.ts         # Express API (WebSocket server, 70+ routes)
│   ├── presets.ts       # Server preset definitions
│   └── openapi.ts       # OpenAPI 3.1 specification
├── public/
│   ├── manifest.json    # PWA manifest
│   └── sw.js            # Service worker (cache-first strategy)
├── db/
│   └── schema.sql       # PostgreSQL schema with RLS (16+ tables including audit_log, notification_channels)
├── docs/
│   ├── PERSONAL_MODE.md # Mode architecture
│   ├── DATABASE_SETUP.md # Setup guide
│   └── ARCHITECTURE.md   # Technical architecture
├── tests/
│   ├── helpers/          # Shared test mocks (supabase-mock, http-client)
│   ├── unit/             # Unit tests (auth-storage)
│   ├── integration/      # API integration tests (api, rate-limit)
│   └── playwright/       # Playwright E2E browser tests
├── package.json         # Dependencies (includes ws dependency)
├── vite.config.ts       # Frontend build config
└── tsconfig.json        # TypeScript config
```

---

## 🔌 API Reference

### Interactive Docs
```
GET    /api/docs                          Swagger UI (browser)
GET    /api/openapi.json                  OpenAPI 3.1 spec (JSON)
```

### Setup
```
GET    /api/setup/status                  Check if initialized
POST   /api/setup/init                    Initialize with admin + mode (rate-limited: 10 req/15min)
```

### Docker Apps
```
GET    /api/apps                          List user's apps
POST   /api/apps                          Create new app
GET    /api/apps/:appId                   Get app details
PATCH  /api/apps/:appId                   Update app settings
DELETE /api/apps/:appId                   Delete app
```

### Container Control (Real Docker exec)
```
POST   /api/apps/:appId/start             Start container via `docker start`
POST   /api/apps/:appId/stop              Stop container via `docker stop`
POST   /api/apps/:appId/restart           Restart container via `docker restart`
GET    /api/apps/:appId/logs              Get logs (paginated)
```

### WebSocket Real-Time
```
ws://host:3001?appId=<id>                 WebSocket connection for live logs & metrics
  → {"type":"subscribe","appId":"<id>"}         Starts docker logs -f streaming
  → {"type":"subscribe:metrics","appId":"<id>"} Starts docker stats every 2s
```

### User & Config
```
GET    /api/user                          Current user profile
GET    /api/config/mode                   Get mode (personal/business)
GET    /health                            API health check
```

### Monitoring & Metrics
```
GET    /api/apps/:appId/metrics            Server metrics (TPS, CPU, memory, players) with time range
GET    /api/metrics/aggregated             Aggregated metrics across all apps
```

### Audit Trail
```
GET    /api/audit-log                     Paginated audit log (?user_id=&entity_type=&action=&start_date=&end_date=)
```

### Global Search
```
GET    /api/search?q=<query>              Search apps, backups, and audit logs (min 2 chars)
```

### Notification Channels
```
GET    /api/notification-channels          List notification channels
POST   /api/notification-channels          Create channel (type: email|webhook|telegram, config: JSON)
PATCH  /api/notification-channels/:id      Update channel
DELETE /api/notification-channels/:id      Delete channel
POST   /api/notification-channels/:id/test Send test notification
```

### Access Logs & Config Versions
```
GET    /api/logs/access                    Access logs (paginated)
GET    /api/apps/:appId/config-versions    Config version history
POST   /api/apps/:appId/config-versions    Create config snapshot
POST   /api/apps/:appId/config-versions/:version/rollback  Rollback to version

### Config Editor
```
GET    /api/apps/:appId/config              Get app config (YAML/JSON)
POST   /api/apps/:appId/config              Update app config
GET    /config/read                         Read config file from disk
POST   /config/write                        Write config file to disk
POST   /config/validate                     Validate YAML/JSON syntax
```

### Databases
```
GET    /api/databases                       List MySQL databases
POST   /api/databases                       Provision a new MySQL container
DELETE /api/databases/:id                   Remove a MySQL database
```

### Billing
```
GET    /api/billing/balance                 Get current credit balance
POST   /api/billing/topup                   Add credits to balance
GET    /api/billing/transactions            Transaction history
GET    /api/billing/cost-estimate           Estimate cost for a configuration
GET    /api/billing/rates                   Current billing rates
```

### Modpack Installer
```
GET    /api/modpacks/search                 Search modpacks (?query=&platform=)
POST   /api/apps/:appId/modpacks/install    Install modpack on server
```

### Validation
```
POST   /api/validate/discord-token          Validate Discord bot token
```

### Deployments
```
GET    /api/deployments                     List deployments
POST   /api/deployments                     Create deployment
DELETE /api/deployments/:id                 Delete deployment
PATCH  /api/deployments/:id/toggle          Toggle deployment active/inactive
```

### Real-Time Metrics
```
GET    /api/metrics/realtime                Live CPU/memory/disk metrics
GET    /api/metrics/history                 Historical metric data
GET    /api/metrics/stream/config           Configure streaming metrics
GET    /api/metrics/grafana-url             Get Grafana dashboard URL
```

### Scheduled Tasks
```
GET    /api/scheduled-tasks                 List scheduled tasks
POST   /api/scheduled-tasks                 Create scheduled task
PATCH  /api/scheduled-tasks/:id             Update scheduled task
DELETE /api/scheduled-tasks/:id             Delete scheduled task
```

### Maintenance Windows
```
GET    /api/maintenance-windows            List maintenance windows
POST   /api/maintenance-windows            Create maintenance window
PATCH  /api/maintenance-windows/:id        Update window
```

### Backups
```
GET    /api/backup-jobs                    List backup jobs
POST   /api/backup-jobs                    Create backup job
PATCH  /api/backup-jobs/:id                Update job
DELETE /api/backup-jobs/:id                Delete job
GET    /api/backup-jobs/:jobId/status      Backup execution history
```

### Alerting
```
GET    /api/alert-configs                  List alert configurations
POST   /api/alert-configs                  Create alert config
PATCH  /api/alert-configs/:id              Update alert config
DELETE /api/alert-configs/:id              Delete alert config
GET    /api/alert-history                  Alert trigger history
POST   /api/alert-history/:id/acknowledge  Acknowledge alert
```

### Health Checks
```
GET    /api/health-checks                  Health check results (optional ?app_id= filter)
```

### Reports
```
GET    /api/reports                        Generate report (optional start_date, end_date)
GET    /api/reports/export                 Export report (?format=csv|pdf)
```

### Customers (Business Mode)
```
GET    /api/customers                      List customers
POST   /api/customers                      Create customer
PATCH  /api/customers/:customerId          Update customer
DELETE /api/customers/:customerId          Delete customer
POST   /api/seed-demo                      Seed demo data (Business Mode only)
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env.local` (see `.env.local.example`):

```bash
# Supabase (localhost dev)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# API Backend
VITE_API_URL=http://localhost:3001

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
```

### Production Setup

See [Database Setup Guide](docs/DATABASE_SETUP.md#production-deployment) for:
- Managed Supabase configuration
- Production environment variables
- Deployment recommendations

---

## 🚦 Development

### Install
```bash
npm install
```

### Start Dev Servers
```bash
# Both frontend (5173) and backend (3001)
npm run dev
```

### Build for Production
```bash
npm run build
```

### Lint & Type Check
```bash
npm run lint
```

### Preview Production Build
```bash
npm run preview
```

---

## 🔒 Security

- **Authentication**: Supabase Auth (email + password)
- **Authorization**: JWT tokens in `Authorization` header
- **Database Security**: Row-level security (RLS) policies
- **User Isolation**: Users only access their own resources
- **Feature Gates**: Mode-based access control

---

## 🐳 Docker Integration

The panel manages Docker containers via direct `docker` CLI calls (start/stop/restart through `child_process.exec`). Container configurations are stored in PostgreSQL via Supabase with full RLS enforcement.

Real-time monitoring is handled via:
- **WebSocket live streaming** - `docker logs -f` and `docker stats --no-stream` pushed to browser in real-time
- **Web Terminal** - In-browser shell via WebSocket + `docker exec`
- **Server metrics** - TPS, CPU, memory, player count, lag spike detection
- **Health checks** - HTTP ping, port checks with uptime/degraded/down status
- **Backup system** - Scheduled backup jobs with retention and status tracking
- **Access logging** - Authentication and console access event recording

---

## 🎯 Use Cases

### Personal Mode
✅ Home lab automation  
✅ Self-hosted hobby projects  
✅ Learning Docker  
✅ Running small production services  
✅ Testing and development  

### Business Mode (Coming Soon)
✅ Managed hosting platform  
✅ VPS reselling  
✅ Container-as-a-Service  
✅ Multi-tenant environments  

---

## 🛣️ Roadmap

### Phase 1 ✅ Complete
- [x] Supabase migration from Convex
- [x] Setup wizard with mode selection
- [x] Docker app CRUD (full backend + frontend)
- [x] Dashboard and app detail pages
- [x] Feature gates framework
- [x] Comprehensive documentation

### Phase 2 ✅ Monitoring & Operations
- [x] Server metrics collection (TPS, CPU, memory, players)
- [x] Health check dashboard with uptime tracking
- [x] Backup job automation and scheduling
- [x] Access log viewer
- [x] Alert configuration and history
- [x] Maintenance window scheduling
- [x] Config version control with rollback
- [x] Reports generation with CSV/PDF export
- [x] Real Docker calls (docker exec for start/stop/restart)
- [x] Real-time WebSocket for live logs & metrics
- [x] Rate-limited login (10 req/15min)

### Phase 3 ✅ UX & Platform
- [x] Theme persistence (localStorage dark/light mode)
- [x] Onboarding wizard (5-step tour)
- [x] PWA support (manifest + service worker)
- [x] Mobile-responsive layout (hamburger menu)
- [x] Global search (Cmd+K palette)
- [x] Audit trail with timeline viewer
- [x] Web terminal (in-browser container shell)
- [x] Notification channels (email, webhook, Telegram)
- [x] OpenAPI/Swagger docs at /api/docs

### Phase 4 ⏳ Business Mode
- [ ] Customer management
- [ ] Plans/pricing UI
- [ ] Billing integration hooks
- [ ] Team management
- [ ] Multi-tenant RBAC

### Phase 5 ⏳ Advanced
- [ ] White-label system
- [ ] Multi-region support
- [ ] Advanced analytics dashboard
- [ ] Kubernetes mode

### Phase 6 ✅ New Features
- [x] Config Editor (in-browser YAML/JSON with syntax highlighting)
- [x] Java Version Selector (8/11/17/21 per server)
- [x] MySQL Database per Click (instant container provisioning)
- [x] Git Deployment Webhook (auto-deploy on GitHub push)
- [x] Cronjob Scheduler (cron-based scheduled tasks)
- [x] Real-time Resource Graphs (live gauges + sparklines)
- [x] Log Search (full-text search with filters & pagination)
- [x] Prepaid Billing (pay-as-you-go balance system)
- [x] Modpack-Installer (one-click CurseForge/Modrinth install)
- [x] 2FA (TOTP) (two-factor authentication)
- [x] Discord Token Validation (validate bot token before start)

---

## 📖 Learn More

- **Mode Architecture**: Read [docs/PERSONAL_MODE.md](docs/PERSONAL_MODE.md)
- **System Design**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Database Setup**: Follow [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)
- **Full Details**: Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## 🐛 Troubleshooting

### "Failed to check setup status"
- Ensure backend API is running on `http://localhost:3001`
- Check `VITE_API_URL` in `.env.local`

### "Connection refused" to Supabase
- Verify Supabase is running (`docker ps`)
- Check `VITE_SUPABASE_URL` points to correct instance
- See [Database Setup Guide](docs/DATABASE_SETUP.md)

### "Not authenticated" after setup
- Check localStorage has `sb_access_token`
- Reload page to refresh token
- Verify backend validates token correctly

---

## 📦 Dependencies

### Core
- **react** - UI framework
- **react-router-dom** - Client-side routing
- **@supabase/supabase-js** - Database & auth
- **axios** - HTTP client
- **sonner** - Toast notifications

### Development
- **typescript** - Type safety
- **tailwindcss** - Styling
- **vite** - Build tool
- **eslint** - Linting

For full list, see [package.json](package.json).

---

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) in repository root.

---

## 📄 License

MIT - See [LICENSE](../../LICENSE)

---

## 🎉 Getting Started

1. **Read**: [README-DOCKER-PANEL.md](README-DOCKER-PANEL.md) (Getting Started Guide)
2. **Setup**: Follow [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)
3. **Run**: `npm run dev`
4. **Visit**: http://localhost:5173
5. **Explore**: Create your first Docker app!

---

## 📞 Support

- 📖 [Full Documentation](docs/)
- 🐛 [GitHub Issues](https://github.com/DaaanielTV/infra-pilot/issues)
- 💬 [Discussions](https://github.com/DaaanielTV/infra-pilot/discussions)

---

**Built with ❤️ for self-hosters and developers**
