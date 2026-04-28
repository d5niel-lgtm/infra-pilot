# Docker Panel - Getting Started

This is a self-hosted Docker management panel with Personal Mode (simple) and Hosting Business Mode (full-featured) support.

## Quick Start

### Requirements

- Node.js 18+ and npm
- Docker and Docker Daemon (running locally or remotely)
- Supabase (self-hosted via Docker Compose recommended)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd services/management-panel
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.local.example .env.local
   ```

3. **Configure Supabase** (optional if using self-hosted)
   
   The easiest way is to use Supabase Docker Compose:
   ```bash
   # Pull docker-compose from https://github.com/supabase/supabase/tree/master/docker
   # Edit docker-compose.yml with your JWT secret
   docker-compose -f docker-compose.yml up -d
   ```

   Then connect to the local instance:
   ```
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

4. **Initialize database**
   ```bash
   # Login to Supabase dashboard (http://localhost:3000) with default credentials
   # Navigate to SQL Editor
   # Copy contents from db/schema.sql and execute
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

6. **First-time setup**
   - Visit http://localhost:5173
   - Select Personal Mode (or Business Mode)
   - Create your admin account
   - Done! You're ready to manage Docker apps

### Production Deployment

1. **Build**
   ```bash
   npm run build
   ```

2. **Environment Setup**
   ```bash
   # Point to your production Supabase instance
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=<production-key>
   VITE_API_URL=https://api.yourdomain.com
   ```

3. **Run Backend**
   ```bash
   node server/index.ts  # Daemonize with PM2, systemd, or Docker
   ```

4. **Serve Frontend**
   ```bash
   npx serve dist/  # Or use Nginx, Vercel, etc.
   ```

---

## Project Structure

```
services/management-panel/
├── public/                  # Static assets
├── src/
│   ├── pages/              # Page components (Setup, Dashboard, AppForm, AppDetail)
│   ├── components/         # Reusable components (MainLayout, etc.)
│   ├── lib/
│   │   ├── api.ts         # API client
│   │   ├── auth.ts        # Supabase auth helpers
│   │   └── types.ts       # Types and feature gates
│   ├── App.tsx            # Main app with routing
│   └── main.tsx           # React entry point
├── server/
│   └── index.ts           # Express backend API
├── db/
│   └── schema.sql         # PostgreSQL schema for Supabase
├── docs/
│   └── PERSONAL_MODE.md   # Mode architecture documentation
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Features

### Personal Mode (Default)

✅ **Docker App Management**
- Create, read, update, delete Docker applications
- Pull images from Docker Hub or custom registries
- Port mapping (host ↔ container)
- Environment variable configuration
- Volume/mount management
- Memory and CPU limits

✅ **Container Controls**
- Start/stop/restart containers
- View container status in real-time
- Stream logs (paginated retrieval)
- Container health polling

✅ **Dashboard**
- Quick overview of app status
- Total, running, stopped, error counts
- Click-to-manage app list

### Hosting Business Mode (Coming Soon)

⏳ Customer account management  
⏳ Plans and pricing tiers  
⏳ Billing integration hooks  
⏳ White-label branding  
⏳ Team and staff RBAC  
⏳ Audit logging  

For details, see [PERSONAL_MODE.md](docs/PERSONAL_MODE.md)

---

## API Overview

All API calls require Bearer token in `Authorization` header after setup.

### Setup Endpoints

```
GET  /api/setup/status         # Check if initialized
POST /api/setup/init           # Initialize with mode + admin account
```

### Docker App Endpoints

```
GET    /api/apps               # List user's apps
POST   /api/apps               # Create new app
GET    /api/apps/:appId        # Get app details
PATCH  /api/apps/:appId        # Update app settings
DELETE /api/apps/:appId        # Delete app
```

### Container Control

```
POST   /api/apps/:appId/start      # Start container
POST   /api/apps/:appId/stop       # Stop container
POST   /api/apps/:appId/restart    # Restart container
GET    /api/apps/:appId/logs       # Get logs (paginated)
```

### User & Config

```
GET    /api/user               # Get current user profile
GET    /api/config/mode        # Get setup mode
GET    /health                 # Health check
```

---

## Docker Integration (TODO)

Currently, the backend stores app configurations but doesn't actually pull/run containers yet.

To add Docker integration:

1. **Install Docker SDK**
   ```bash
   npm install dockerode
   ```

2. **Update backend** to actually interact with Docker API:
   ```typescript
   // server/index.ts
   import Docker from 'dockerode';
   
   const docker = new Docker({
     socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
   });
   ```

3. **Implement container operations** in start/stop/restart/create routes

See [docs/DOCKER_INTEGRATION.md](docs/DOCKER_INTEGRATION.md) for detailed implementation guide (TODO).

---

## Mode Architecture

### Personal Mode
- Single-user self-hosting focus
- Simple, minimal UI
- No customer/billing features
- Perfect for hobby projects and home labs

### Business Mode
- Multi-customer hosting platform
- Full admin panel with business features
- Billing hooks and white-label support
- Professional hosting company ready

You can start in Personal Mode and upgrade to Business Mode later without losing data.

See [docs/PERSONAL_MODE.md](docs/PERSONAL_MODE.md) for complete architecture details.

---

## Development

### Run Tests (TODO)
```bash
npm run test
```

### Linting
```bash
npm run lint
```

### Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

---

## Troubleshooting

### "Failed to check setup status"
- Ensure backend API is running on `http://localhost:3001`
- Check `VITE_API_URL` in `.env.local`

### "Connection refused" to Supabase
- Verify Supabase is running (`docker ps`)
- Check `VITE_SUPABASE_URL` points to correct instance
- Ensure JWT secret is configured

### "Not authenticated" after setup
- Token might have expired; reload page
- Check localStorage has `sb_access_token`
- Verify backend validates token correctly

### Docker operations fail
- Ensure Docker daemon is running
- Check `DOCKER_HOST` environment variable
- Verify permissions on docker.sock (if using Unix socket)

---

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) in repository root.

---

## License

MIT - See [LICENSE](../../../LICENSE) in repository root.

---

## Support

- 📖 [Mode Architecture Docs](docs/PERSONAL_MODE.md)
- 🐛 [GitHub Issues](https://github.com/DaaanielTV/infra-pilot/issues)
- 💬 [Discussions](https://github.com/DaaanielTV/infra-pilot/discussions)
