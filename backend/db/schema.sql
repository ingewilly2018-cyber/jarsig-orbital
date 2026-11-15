-- =========================================================================
-- JARSIG Mission Control - Pure DDL Database Schema
-- Target: PostgreSQL 18+
-- =========================================================================

DROP TABLE IF EXISTS flight_telemetry_runs CASCADE;
DROP TABLE IF EXISTS landing_sites CASCADE;
DROP TABLE IF EXISTS mission_logs CASCADE;
DROP TABLE IF EXISTS surface_assets CASCADE;
DROP TABLE IF EXISTS psr_zones CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users & Authentication Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- 2. Surface Assets Table (Populated via Admin API / Telemetry Bus)
CREATE TABLE surface_assets (
    asset_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    pos_x REAL NOT NULL DEFAULT 0.0,
    pos_y REAL NOT NULL DEFAULT 0.0,
    pos_z REAL NOT NULL DEFAULT 0.0,
    status VARCHAR(30) NOT NULL DEFAULT 'NOMINAL',
    battery_pct VARCHAR(10) NOT NULL DEFAULT '100%',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. PSR Zones Table (Populated dynamically from NASA Moon Trek / Quickmap)
CREATE TABLE psr_zones (
    id SERIAL PRIMARY KEY,
    crater_name VARCHAR(100) UNIQUE NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius_km REAL NOT NULL,
    ice_probability_pct INTEGER CHECK (ice_probability_pct BETWEEN 0 AND 100),
    permanent_shadow BOOLEAN DEFAULT TRUE NOT NULL
);

-- 4. Curated Landing Sites Table (For rapid scenario evaluation)
CREATE TABLE landing_sites (
    site_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    region VARCHAR(100) NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation_m REAL NOT NULL DEFAULT 0.0,
    slope_deg REAL NOT NULL DEFAULT 0.0,
    horizon_obstruction_deg REAL NOT NULL DEFAULT 0.0, -- Crater rim angle blocking sun/earth
    water_ice_probability_pct INTEGER CHECK (water_ice_probability_pct BETWEEN 0 AND 100),
    description TEXT
);

CREATE INDEX idx_landing_sites_coords ON landing_sites(latitude, longitude);

-- 5. AI Training Telemetry Runs Table (Captures user gameplay/training data)
CREATE TABLE flight_telemetry_runs (
    run_id SERIAL PRIMARY KEY,
    operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_site_id INTEGER REFERENCES landing_sites(site_id) ON DELETE CASCADE,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    final_fuel_pct REAL NOT NULL,
    touchdown_descent_rate REAL NOT NULL, -- m/s
    touchdown_drift_rate REAL NOT NULL,   -- m/s
    flight_duration_sec INTEGER NOT NULL,
    trajectory_payload JSONB NOT NULL,    -- Stores time-series array of position, velocity, and throttle inputs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_telemetry_operator ON flight_telemetry_runs(operator_id);
CREATE INDEX idx_telemetry_success ON flight_telemetry_runs(success);

-- 6. Mission Telemetry & Event Logs Table
CREATE TABLE mission_logs (
    id SERIAL PRIMARY KEY,
    operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    mission_time_offset VARCHAR(20) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_mission_logs_time ON mission_logs(logged_at);