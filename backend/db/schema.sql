-- JARSIG PostgreSQL schema. Safe to re-run: creates or extends tables without
-- dropping existing data. User authentication remains managed by Supabase Auth.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    supabase_user_id UUID,
    password_change_required BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Upgrade the original JARSIG schema in place without losing accounts or logs.
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_user_id ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS surface_assets (
    asset_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    pos_x REAL NOT NULL DEFAULT 0,
    pos_y REAL NOT NULL DEFAULT 0,
    pos_z REAL NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'NOMINAL',
    battery_pct VARCHAR(10) NOT NULL DEFAULT '100%',
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS psr_zones (
    id SERIAL PRIMARY KEY,
    crater_name VARCHAR(100) UNIQUE NOT NULL,
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    radius_km REAL NOT NULL CHECK (radius_km > 0),
    ice_probability_pct INTEGER CHECK (ice_probability_pct BETWEEN 0 AND 100),
    permanent_shadow BOOLEAN DEFAULT TRUE NOT NULL,
    source_name VARCHAR(100),
    source_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE psr_zones ADD COLUMN IF NOT EXISTS source_name VARCHAR(100);
ALTER TABLE psr_zones ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE psr_zones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;

CREATE TABLE IF NOT EXISTS mission_logs (
    id SERIAL PRIMARY KEY,
    operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    mission_time_offset VARCHAR(20) NOT NULL DEFAULT 'T+00:00',
    logged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mission_logs_time ON mission_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_logs_operator_time ON mission_logs(operator_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS site_analyses (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_name VARCHAR(120) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    altitude_km DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (altitude_km BETWEEN -10 AND 100),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    results JSONB NOT NULL,
    source VARCHAR(80) NOT NULL DEFAULT 'JPL Horizons',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_site_analyses_user_created ON site_analyses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mission_updates (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(80) NOT NULL,
    source_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ,
    category VARCHAR(40) NOT NULL DEFAULT 'update' CHECK (category IN ('past', 'upcoming', 'update')),
    mission_name VARCHAR(160),
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mission_updates_published ON mission_updates(published_at DESC);

CREATE TABLE IF NOT EXISTS ephemeris_cache (
    cache_key CHAR(64) PRIMARY KEY,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ephemeris_cache_expiry ON ephemeris_cache(expires_at);
