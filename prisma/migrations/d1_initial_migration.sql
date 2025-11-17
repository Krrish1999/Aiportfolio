-- D1 Migration for AI Resume Portfolio
-- SQLite-compatible schema
-- 
-- Type Conversions from PostgreSQL:
-- - UUID -> TEXT (use crypto.randomUUID() in code)
-- - JSONB -> TEXT (use JSON.stringify/parse in code)
-- - BOOLEAN -> INTEGER (0/1, convert in code)
-- - TIMESTAMP -> TEXT (ISO 8601 format, use new Date().toISOString() in code)
-- - DECIMAL -> REAL (for numeric fields)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Resume sessions table
-- parsed_data stores JSON as TEXT (was JSONB in PostgreSQL)
CREATE TABLE IF NOT EXISTS resume_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_format TEXT NOT NULL,
  processing_status TEXT NOT NULL,
  parsed_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Portfolios table
-- customizations stores JSON as TEXT (was JSONB in PostgreSQL)
-- is_published is INTEGER (was BOOLEAN in PostgreSQL)
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  customizations TEXT,
  deployment_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES resume_sessions(id) ON DELETE CASCADE
);

-- Parsing metrics table
-- confidence_score is REAL (was DECIMAL in PostgreSQL)
-- was_edited is INTEGER (was BOOLEAN in PostgreSQL)
CREATE TABLE IF NOT EXISTS parsing_metrics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  was_edited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES resume_sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resume_sessions_user_id ON resume_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_session_id ON portfolios(session_id);
CREATE INDEX IF NOT EXISTS idx_parsing_metrics_session_id ON parsing_metrics(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
