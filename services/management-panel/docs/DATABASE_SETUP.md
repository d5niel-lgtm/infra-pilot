# Database Setup Instructions

## Using Supabase with Docker Compose

### Step 1: Clone Supabase Docker Repository

```bash
git clone https://github.com/supabase/supabase.git
cd supabase/docker
```

### Step 2: Configure Environment

Edit `docker/.env` and set a strong JWT secret:

```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

### Step 3: Start Supabase

```bash
docker compose up -d
```

This starts:
- API: http://localhost:8000
- Supabase Dashboard: http://localhost:3000
- PostgreSQL: localhost:5432

### Step 4: Access Dashboard

1. Go to http://localhost:3000
2. Email: `supabase@example.com`
3. Password: `password`

### Step 5: Create Anon Key

1. In Supabase Dashboard, go to **Settings → API**
2. Copy the `anon` public key
3. Add to `.env.local`:
   ```
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

### Step 6: Initialize Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Create new query
3. Copy contents of `db/schema.sql`
4. Execute

Or via psql:

```bash
psql -h localhost -U postgres -d postgres < db/schema.sql
```

(Default postgres password: `postgres`)

### Step 7: Enable JWT Auth

In Supabase Dashboard → Settings → Auth, ensure:
- Email/Password enabled
- Email confirmation disabled (for dev)

---

## Environment Variables

Create `.env.local`:

```bash
# Supabase (Docker Compose)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<copy-from-dashboard>

# API Backend
VITE_API_URL=http://localhost:3001

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
```

---

## Production Deployment

### Using Managed Supabase

1. Sign up at https://supabase.com
2. Create a new project
3. Go to Settings → API
4. Copy your `URL` and `anon key`
5. Set in production environment:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-key>
   ```
6. Run schema migration on your production database

### Self-Hosted PostgreSQL

If not using Supabase, you need to:

1. Set up PostgreSQL 15+
2. Create a database for the panel
3. Run `db/schema.sql` to initialize
4. Set up Supabase Auth (separate component) OR migrate to a simpler auth method
5. Update backend to connect to your PostgreSQL instance

---

## Troubleshooting

### Port 54321 already in use
```bash
lsof -i :54321
kill -9 <PID>
# Or change docker-compose port mapping
```

### Can't connect to PostgreSQL
```bash
docker compose logs postgres
# Check credentials in docker/.env
```

### Schema migration fails
```bash
# Check DB logs
docker compose logs postgres

# Verify psql connection
psql -h localhost -U postgres -d postgres
```

### JWT Secret format invalid
Must be minimum 32 characters. Generate with:

```bash
openssl rand -base64 32
```

---

## Next Steps

Once setup is complete:

```bash
npm run dev
```

Then visit http://localhost:5173 to initialize the panel.
