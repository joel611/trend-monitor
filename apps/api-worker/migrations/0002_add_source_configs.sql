-- Create source_configs table for feed source configuration
CREATE TABLE IF NOT EXISTS source_configs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('feed', 'x')),
    config TEXT NOT NULL,  -- JSON string
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for querying by type
CREATE INDEX idx_source_configs_type ON source_configs(type);

-- Index for querying enabled configs
CREATE INDEX idx_source_configs_enabled ON source_configs(enabled);
