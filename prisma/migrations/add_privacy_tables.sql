-- Add user consent table for privacy controls
CREATE TABLE IF NOT EXISTS user_consent (
  user_id TEXT PRIMARY KEY,
  data_processing INTEGER NOT NULL DEFAULT 1,
  analytics INTEGER NOT NULL DEFAULT 0,
  marketing_emails INTEGER NOT NULL DEFAULT 0,
  consented_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add deletion requests table for scheduled deletions
CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON deletion_requests(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_user_consent_user_id ON user_consent(user_id);
