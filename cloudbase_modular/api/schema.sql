-- ATLAS D1 Database Schema
-- Deploy: wrangler d1 execute atlas-db --file=api/schema.sql

CREATE TABLE IF NOT EXISTS assessments (
  id               TEXT PRIMARY KEY,
  workspace_key    TEXT NOT NULL,
  q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER,
  q5 INTEGER, q6 INTEGER, q7 INTEGER, q8 INTEGER,
  mmas_score       REAL,
  adherence_tier   TEXT CHECK(adherence_tier IN ('high','medium','low')),
  patient_number   TEXT,
  condition        TEXT,
  medication       TEXT,
  country          TEXT,
  country_iso2     TEXT,
  language         TEXT DEFAULT 'en',
  collection_method TEXT DEFAULT 'direct',
  site_id          TEXT,
  ts               INTEGER NOT NULL,
  submitted_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_assessments_workspace  ON assessments(workspace_key);
CREATE INDEX IF NOT EXISTS idx_assessments_tier       ON assessments(adherence_tier);
CREATE INDEX IF NOT EXISTS idx_assessments_ts         ON assessments(ts DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_condition  ON assessments(condition);

CREATE TABLE IF NOT EXISTS public_stats (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  total_assessments    INTEGER DEFAULT 0,
  countries            INTEGER DEFAULT 0,
  avg_score            REAL,
  high_adherence_pct   REAL,
  medium_adherence_pct REAL,
  low_adherence_pct    REAL,
  updated_at           TEXT DEFAULT (datetime('now'))
);
