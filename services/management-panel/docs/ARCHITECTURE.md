# Docker Panel Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       User Browser                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         React Frontend (http://localhost:5173)          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  App Router (React Router v6)                 │    │  │
│  │  │  ├─ /setup → Setup Wizard                     │    │  │
│  │  │  ├─ /dashboard → Dashboard                    │    │  │
│  │  │  ├─ /apps/new → AppForm (Create)             │    │  │
│  │  │  ├─ /apps/:id → AppDetail                    │    │  │
│  │  │  └─ /apps/:id/edit → AppForm (Edit)          │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  Global State                                  │    │  │
│  │  │  ├─ ConfigContext (mode: personal|business)   │    │  │
│  │  │  └─ localStorage (JWT token)                  │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  Feature Gates                                 │    │  │
│  │  │  └─ featureGates.canXXX(mode: SetupMode)      │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│              HTTP Client (Axios + JWT Token)                     │
│                                                                   │
└──────────────┬──────────────────────────────────────────────────┘
               │ HTTPS/HTTP
               ▼
        ┌──────────────────┐
        │  Firewall/Proxy  │
        └─────────┬────────┘
                  │
        ┌─────────▼─────────────────────────────────────────┐
        │   Backend API Server (Express.js localhost:3001)  │
        ├───────────────────────────────────────────────────┤
        │                                                   │
        │  ┌─────────────────────────────────────────────┐ │
        │  │  Express Routes                            │ │
        │  │  ├─ /api/setup/* - Setup endpoints         │ │
        │  │  ├─ /api/apps/* - CRUD operations          │ │
        │  │  ├─ /api/apps/:id/[start|stop|restart]    │ │
        │  │  ├─ /api/apps/:id/logs - Log streaming     │ │
        │  │  ├─ /api/user - User profile              │ │
        │  │  ├─ /api/config/* - Configuration         │ │
        │  │  └─ /health - Health check                │ │
        │  └─────────────────────────────────────────────┘ │
        │                                                   │
        │  ┌─────────────────────────────────────────────┐ │
        │  │  Middleware                                │ │
        │  │  ├─ CORS                                   │ │
        │  │  ├─ JSON Parser                            │ │
        │  │  ├─ Auth (verifyAuth middleware)           │ │
        │  │  └─ Error Handling                         │ │
        │  └─────────────────────────────────────────────┘ │
        │                                                   │
        └────────────┬──────────────────┬──────────────────┘
                     │                  │
                     │ JWT Validation   │ HTTPS/TCP
                     ▼                  ▼
        ┌─────────────────────────────────────────┐
        │    Supabase Auth                        │
        │  (Handles user creation, JWT signing)   │
        └─────────────┬───────────────────────────┘
                      │
                      │ PostgreSQL Protocol
                      ▼
        ┌──────────────────────────────────────────────────┐
        │  PostgreSQL Database (Supabase)                  │
        │  localhost:5432 (dev) or managed (prod)          │
        ├──────────────────────────────────────────────────┤
        │                                                   │
        │  ┌─────────────────────────────────────────────┐ │
        │  │  Tables                                     │ │
        │  │  ├─ auth.users (Supabase managed)          │ │
        │  │  ├─ user_profiles (with RLS)               │ │
        │  │  ├─ setup_config (mode, initialized)        │ │
        │  │  ├─ docker_apps (container configs)        │ │
        │  │  ├─ app_logs (application logs)            │ │
        │  │  ├─ pterodactyl_config (optional)          │ │
        │  │  └─ shared_config (key-value store)         │ │
        │  └─────────────────────────────────────────────┘ │
        │                                                   │
        │  ┌─────────────────────────────────────────────┐ │
        │  │  Security (RLS Policies)                    │ │
        │  │  ├─ Users see only their own apps          │ │
        │  │  ├─ Admins can manage setup config         │ │
        │  │  └─ Auto-enforced by PostgreSQL            │ │
        │  └─────────────────────────────────────────────┘ │
        │                                                   │
        └──────────────────────────────────────────────────┘
```

---

## Data Flow: Setup & Authentication

```
┌─────────┐
│ Browser │
└────┬────┘
     │ GET /
     ▼
┌──────────────────────┐
│ Check setup status   │
│ GET /api/setup/statu │
└───────────┬──────────┘
            │
       ┌────┴─────────────────────┐
       │                          │
   NOT initialized           Already initialized
       │                          │
       ▼                          ▼
┌─────────────────┐   ┌──────────────────────┐
│ Show Setup      │   │ Check localStorage   │
│ Wizard          │   │ for JWT token        │
└────┬────────────┘   └──┬───────────────────┘
     │                   │
     │ User selects      ├─ Token exists → Set ConfigContext
     │ mode (personal/   │
     │ business)         └─ No token → Redirect to /setup
     │
     │ User creates admin account
     │
     ▼
┌────────────────────────────┐
│ POST /api/setup/init       │
│ {email, password, mode}    │
└────────┬───────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Supabase Auth                   │
│ signUp({email, password})       │
└────────┬────────────────────────┘
         │
         ├─ Create auth.users row
         │
         ▼
┌──────────────────────────────────┐
│ Create user_profiles row         │
│ {id, display_name, role: admin}  │
└────────┬─────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Create setup_config row        │
│ {mode, initialized: true}      │
└────────┬───────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Return JWT token                 │
│ {access_token, refresh_token}    │
└────────┬─────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Store token in localStorage    │
│ sb_access_token = JWT...       │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Set ConfigContext              │
│ {mode, loading: false}         │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Render Dashboard @/dashboard   │
└────────────────────────────────┘
```

---

## Data Flow: Docker App CRUD

```
User clicks "New App"
        │
        ▼
┌──────────────────────┐
│ Navigate to /apps/new│
└────────┬─────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ <AppForm /> (create mode)          │
│ Show form with fields:             │
│  - name, image                     │
│  - ports (add/remove)              │
│  - environment_vars (add/remove)   │
│  - volumes (add/remove)            │
│  - memory_limit                    │
└────────┬───────────────────────────┘
         │
         │ User fills in form
         │ (e.g., name="web", image="nginx:latest")
         │
         ▼
┌─────────────────────────────────────┐
│ Form submission validation          │
│ if (!name || !image) error "Required"
└────┬────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────┐
│ POST /api/apps                                 │
│ Authorization: Bearer <JWT>                    │
│ {name, image, ports, env, volumes, ...}       │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Backend: verifyAuth        │
│ Validate JWT signature     │
└────────┬───────────────────┘
         │
         ├─ Invalid? → 401 Unauthorized
         │
         ▼
┌─────────────────────────────┐
│ Insert docker_apps row      │
│ {user_id, name, image, ...} │
└────────┬────────────────────┘
         │
         ├─ RLS checks: user_id == auth.uid()
         │
         ▼
┌─────────────────────────────┐
│ Return 201 Created          │
│ {id, name, image, status}   │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Frontend receives app    │
│ Show success toast       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Navigate to /apps/{id}   │
│ App detail page loads    │
└──────────────────────────┘
```

---

## Feature Gate Checking

```
Component wants to render business feature
        │
        ▼
┌────────────────────────────────────┐
│ const { mode } = useConfig()       │
│ Returns: 'personal' or 'business'  │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Check feature gate:                │
│ if (!featureGates.canXXX(mode)) {  │
│   return <Disabled />              │
│ }                                  │
└────────┬───────────────────────────┘
         │
      ┌──┴──────────────────────────────┐
         │                                    │
    mode == 'personal'              mode == 'business'
         │                                    │
         ▼                                    ▼
┌──────────────────────┐      ┌──────────────────────┐
│ Feature hidden       │      │ Feature visible      │
│ Show helpful message │      │ Full functionality   │
│ "Not available in    │      │ available            │
│  Personal Mode"      │      │                      │
└──────────────────────┘      └──────────────────────┘
```

---

## Mode Decision Tree

```
Setup Wizard
    │
    ├─ Select Personal Mode
    │   │
    │   ├─ Features Enabled:
    │   │   ├─ Docker app CRUD ✅
    │   │   ├─ Container controls ✅
    │   │   ├─ Logs & monitoring ✅
    │   │   └─ Single admin ✅
    │   │
    │   └─ Features Disabled:
    │       ├─ Customer management ❌
    │       ├─ Plans/billing ❌
    │       ├─ White-label ❌
    │       └─ Team management ❌
    │
    └─ Select Business Mode
        │
        ├─ Features Enabled:
        │   ├─ All Personal Mode features ✅
        │   ├─ Customer management ✅
        │   ├─ Plans/billing ✅
        │   ├─ White-label ✅
        │   └─ Team management ✅
        │
        └─ Additional Considerations:
            ├─ More database tables
            ├─ Advanced RBAC
            └─ Billing hooks
```

---

## Deployment Architecture (Production)

```
┌──────────────────────────────────────────────────────────┐
│  User's Internet                                         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
           ┌─────────────────────┐
           │  CDN / Load Balancer│
           │  (Optional: Vercel) │
           └──────────┬──────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
   ┌─────────────┐      ┌──────────────────────┐
   │ Frontend    │      │ Backend API          │
   │ (Nginx,     │      │ (Node.js + Express)  │
   │  Vercel, or │      │ (Docker container)   │
   │  your host) │      └──────────┬───────────┘
   └─────────────┘                 │
                                   ▼
                          ┌─────────────────────┐
                          │  Supabase Project   │
                          │  (Managed or        │
                          │   Self-hosted)      │
                          ├─────────────────────┤
                          │ PostgreSQL          │
                          │ Auth                │
                          │ RLS/Security        │
                          └─────────────────────┘
                                   │
                                   ▼
                          ┌─────────────────────┐
                          │  Docker Daemon      │
                          │  (Local or remote)  │
                          │  /var/run/docker.sock
                          │  OR tcp://docker:2375
                          └─────────────────────┘
```

---

## Summary

- **Frontend**: React SPA with client-side routing and JWT auth
- **Backend**: Express.js REST API with route-level auth & RLS
- **Database**: PostgreSQL with row-level security
- **Auth**: Supabase Auth (JWT tokens)
- **Feature Gates**: Configured at setup, checked everywhere
- **Scaling**: Easy to add Business Mode tables/routes later

The architecture is **modular, secure, and extensible**.
