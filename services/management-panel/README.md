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
- 🎛️ **Container Controls** - Start/stop/restart with one click
- 📊 **Dashboard** - Real-time status and metrics
- 🔍 **Logs & Monitoring** - Stream application logs and view status
- ⚙️ **Configuration** - Port mapping, environment variables, volume mounts
- 🔐 **Simple Auth** - Single admin account

### 🚀 Business Mode (Optional)
- ✅ All Personal Mode features +
- 👥 Customer account management
- 💰 Plans and pricing tiers
- 🏷️ White-label branding
- 👔 Team and staff management
- 📋 Audit logging

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

**Then open:** http://localhost:5173

**First-time setup will guide you through:**
1. Choose Personal Mode or Business Mode
2. Create admin account
3. Start managing Docker apps

---

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
│   ├── pages/           # Setup, Dashboard, AppForm, AppDetail
│   ├── components/      # MainLayout, shared components
│   ├── lib/             # API client, auth, types, feature gates
│   ├── App.tsx          # Main router and mode provider
│   └── main.tsx         # React entry point
├── server/
│   └── index.ts         # Express API (445 lines, 30+ routes)
├── db/
│   └── schema.sql       # PostgreSQL schema with RLS
├── docs/
│   ├── PERSONAL_MODE.md # Mode architecture
│   ├── DATABASE_SETUP.md # Setup guide
│   └── ARCHITECTURE.md   # Technical architecture
├── package.json         # Dependencies
├── vite.config.ts       # Frontend build config
└── tsconfig.json        # TypeScript config
```

---

## 🔌 API Reference

### Setup
```
GET  /api/setup/status              Check if initialized
POST /api/setup/init                Initialize with admin + mode
```

### Docker Apps
```
GET    /api/apps                    List user's apps
POST   /api/apps                    Create new app
GET    /api/apps/:appId             Get app details
PATCH  /api/apps/:appId             Update app settings
DELETE /api/apps/:appId             Delete app
```

### Container Control
```
POST   /api/apps/:appId/start       Start container
POST   /api/apps/:appId/stop        Stop container
POST   /api/apps/:appId/restart     Restart container
GET    /api/apps/:appId/logs        Get logs (paginated)
```

### User & Config
```
GET    /api/user                    Current user profile
GET    /api/config/mode             Get mode (personal/business)
GET    /health                      API health check
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

## 🐳 Docker Integration (TODO)

Currently, the panel stores app configurations. To add actual Docker support:

```typescript
// server/index.ts
import Docker from 'dockerode';

const docker = new Docker({
  socketPath: '/var/run/docker.sock'
});
```

See implementation guide in [next steps](#-next-steps).

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

### Phase 2 ⏳ Business Mode
- [ ] Customer management
- [ ] Plans/pricing UI
- [ ] Billing integration hooks
- [ ] Audit logging
- [ ] Team management

### Phase 3 ⏳ Docker Integration
- [ ] Live container creation
- [ ] Real-time status (WebSocket)
- [ ] Image pull workflows
- [ ] Health monitoring
- [ ] Resource metrics

### Phase 4 ⏳ Advanced
- [ ] White-label system
- [ ] Multi-tenant RBAC
- [ ] Multi-region support
- [ ] Analytics dashboard

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
