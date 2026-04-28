-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Setup Configuration
CREATE TABLE IF NOT EXISTS setup_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mode VARCHAR(50) NOT NULL DEFAULT 'personal' CHECK (mode IN ('personal', 'business')),
  initialized BOOLEAN NOT NULL DEFAULT FALSE,
  admin_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES auth.users (id) ON DELETE SET NULL
);

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(255),
  avatar_url VARCHAR(1000),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  mode_at_signup VARCHAR(50) DEFAULT 'personal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Docker Apps
CREATE TABLE IF NOT EXISTS docker_apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  image VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'stopped' CHECK (status IN ('running', 'stopped', 'restarting', 'error')),
  container_id VARCHAR(255),
  ports JSONB, -- [{hostPort: 8080, containerPort: 8000, protocol: 'tcp'}, ...]
  environment_vars JSONB, -- {KEY: value, ...}
  volumes JSONB, -- [{hostPath: '/data', containerPath: '/app/data'}, ...]
  restart_policy VARCHAR(50) DEFAULT 'no' CHECK (restart_policy IN ('no', 'always', 'unless-stopped', 'on-failure')),
  memory_limit VARCHAR(50), -- e.g., '512m', '1g'
  cpu_shares INT,
  description TEXT,
  labels JSONB, -- {tier: 'production', team: 'web', ...}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- App Logs (optional: for log streaming)
CREATE TABLE IF NOT EXISTS app_logs (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES docker_apps(id) ON DELETE CASCADE,
  level VARCHAR(20) DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_app_id_created (app_id, created_at DESC)
);

-- Pterodactyl Configuration (for optional remote panel support)
CREATE TABLE IF NOT EXISTS pterodactyl_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key VARCHAR(255) NOT NULL,
  panel_url VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Shared Configuration (for setup wizard settings, feature flags, etc.)
CREATE TABLE IF NOT EXISTS shared_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies
ALTER TABLE docker_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pterodactyl_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Docker Apps RLS
CREATE POLICY "Users can view their own apps" ON docker_apps
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own apps" ON docker_apps
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own apps" ON docker_apps
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own apps" ON docker_apps
FOR DELETE USING (auth.uid() = user_id);

-- App Logs RLS
CREATE POLICY "Users can view logs for their apps" ON app_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM docker_apps
    WHERE docker_apps.id = app_logs.app_id
    AND docker_apps.user_id = auth.uid()
  )
);

-- Pterodactyl Config RLS
CREATE POLICY "Users can view their own pterodactyl config" ON pterodactyl_config
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own pterodactyl config" ON pterodactyl_config
FOR UPDATE USING (auth.uid() = user_id);

-- User Profiles RLS
CREATE POLICY "Users can view their own profile" ON user_profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
FOR UPDATE USING (auth.uid() = id);
