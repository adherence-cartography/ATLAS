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
  submitted_at     TEXT,
  -- MAP instrument columns (additive via ALTER TABLE for existing deployments)
  instrument_type  TEXT DEFAULT 'mmas' CHECK(instrument_type IN ('mmas','map','both')),
  arch_score       REAL,
  exec_score       REAL,
  ctx_score        REAL,
  pe_score         REAL,
  peacs_phenotype  TEXT,
  assessment_mode  TEXT DEFAULT 'clinical' CHECK(assessment_mode IN ('clinical','pharmacy','self','research','chw')),
  session_id       TEXT,
  assessor_id      TEXT
);

CREATE INDEX IF NOT EXISTS idx_assessments_workspace   ON assessments(workspace_key);
CREATE INDEX IF NOT EXISTS idx_assessments_tier        ON assessments(adherence_tier);
CREATE INDEX IF NOT EXISTS idx_assessments_ts          ON assessments(ts DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_condition   ON assessments(condition);
CREATE INDEX IF NOT EXISTS idx_assessments_instrument  ON assessments(instrument_type);
CREATE INDEX IF NOT EXISTS idx_assessments_pe          ON assessments(pe_score);
CREATE INDEX IF NOT EXISTS idx_assessments_session     ON assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_assessments_mode        ON assessments(assessment_mode);

-- ALTER TABLE statements for existing deployments that already have the assessments table
-- Run these separately if the table already exists:
--   ALTER TABLE assessments ADD COLUMN instrument_type TEXT DEFAULT 'mmas';
--   ALTER TABLE assessments ADD COLUMN arch_score REAL;
--   ALTER TABLE assessments ADD COLUMN exec_score REAL;
--   ALTER TABLE assessments ADD COLUMN ctx_score REAL;
--   ALTER TABLE assessments ADD COLUMN pe_score REAL;
--   ALTER TABLE assessments ADD COLUMN peacs_phenotype TEXT;
--   ALTER TABLE assessments ADD COLUMN assessment_mode TEXT DEFAULT 'clinical';
--   ALTER TABLE assessments ADD COLUMN session_id TEXT;
--   ALTER TABLE assessments ADD COLUMN assessor_id TEXT;

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

-- MAP longitudinal session tracking
-- Accumulates repeated MAP assessments for a single patient over time.
-- Trajectory columns store JSON arrays of domain scores in chronological order.
CREATE TABLE IF NOT EXISTS map_longitudinal_sessions (
  session_id       TEXT PRIMARY KEY,
  patient_number   TEXT NOT NULL,
  workspace_key    TEXT NOT NULL,
  condition        TEXT,
  started_at       INTEGER NOT NULL,
  last_updated     INTEGER,
  assessment_count INTEGER DEFAULT 0,
  baseline_pe      REAL,
  latest_pe        REAL,
  arch_trajectory  TEXT,
  exec_trajectory  TEXT,
  ctx_trajectory   TEXT,
  pe_trajectory    TEXT,
  dropout_risk     REAL,
  dominant_domain  TEXT CHECK(dominant_domain IN ('architecture','execution','context_guard','balanced'))
);

CREATE INDEX IF NOT EXISTS idx_map_sessions_workspace ON map_longitudinal_sessions(workspace_key);
CREATE INDEX IF NOT EXISTS idx_map_sessions_patient   ON map_longitudinal_sessions(patient_number);
CREATE INDEX IF NOT EXISTS idx_map_sessions_updated   ON map_longitudinal_sessions(last_updated DESC);

-- ── MaaS API Key Management ────────────────────────────────────────────────
-- Stores hashed API keys for external partner integrations (EHR, pharmacy, etc.)
-- Raw keys are NEVER persisted; only SHA-256 hashes.
CREATE TABLE IF NOT EXISTS maas_api_keys (
  key_id                TEXT PRIMARY KEY,
  key_hash              TEXT NOT NULL UNIQUE,
  key_prefix            TEXT NOT NULL,
  workspace_key         TEXT NOT NULL,
  partner_name          TEXT NOT NULL,
  partner_type          TEXT CHECK(partner_type IN ('ehr','pharmacy','research','government','pharma','other')),
  allowed_endpoints     TEXT DEFAULT '*',
  rate_limit_per_hour   INTEGER DEFAULT 1000,
  calls_this_hour       INTEGER DEFAULT 0,
  hour_window_start     INTEGER,
  total_calls           INTEGER DEFAULT 0,
  created_at            INTEGER NOT NULL,
  last_used             INTEGER,
  active                INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_maas_key_hash  ON maas_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_maas_workspace ON maas_api_keys(workspace_key);

-- ALTER TABLE migration stubs for existing assessments tables:
-- ALTER TABLE assessments ADD COLUMN maas_key_id TEXT;
-- ALTER TABLE assessments ADD COLUMN api_caller  TEXT;

-- ── DHIS2 Integration — WHO Health Information System ──────────────────────
-- Stores one row per DHIS2 server connection per workspace.
-- Passwords are encrypted at-rest using AES-GCM (Web Crypto) before storage.
CREATE TABLE IF NOT EXISTS dhis2_connections (
  id                       TEXT PRIMARY KEY,
  workspace_key            TEXT NOT NULL,
  server_url               TEXT NOT NULL,
  username                 TEXT NOT NULL,
  password_enc             TEXT NOT NULL,
  program_id               TEXT,
  org_unit_id              TEXT,
  map_data_element_prefix  TEXT DEFAULT 'ATLAS_MAP',
  last_sync                INTEGER,
  sync_count               INTEGER DEFAULT 0,
  active                   INTEGER DEFAULT 1,
  created_at               INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dhis2_workspace ON dhis2_connections(workspace_key);

-- ALTER TABLE assessments ADD COLUMN dhis2_event_id TEXT;
-- ALTER TABLE assessments ADD COLUMN dhis2_synced   INTEGER DEFAULT 0;

-- ── MAP Certification Program — TESSERA GRC / Scala Carta Foundation ──────
-- Stores issued MAP certifications for clinicians, pharmacists, and researchers.
-- Cert numbers are public-facing identifiers used for verification by FOFI/Rome
-- network pharmacies and hospitals.  workspace_key and user_id are never returned
-- by the public verify or directory endpoints.
CREATE TABLE IF NOT EXISTS map_certifications (
  cert_id           TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  workspace_key     TEXT NOT NULL,
  practitioner_name TEXT NOT NULL,
  practitioner_role TEXT CHECK(practitioner_role IN ('pharmacist','physician','nurse','researcher','chw','other')),
  institution       TEXT,
  country           TEXT,
  country_iso2      TEXT,
  cert_level        TEXT CHECK(cert_level IN ('foundation','advanced','trainer')) DEFAULT 'foundation',
  training_score    REAL,
  competency_score  REAL,
  issued_at         INTEGER,
  expires_at        INTEGER,
  cert_number       TEXT UNIQUE,
  active            INTEGER DEFAULT 1,
  renewal_count     INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cert_user      ON map_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_workspace ON map_certifications(workspace_key);
CREATE INDEX IF NOT EXISTS idx_cert_country   ON map_certifications(country_iso2);
CREATE INDEX IF NOT EXISTS idx_cert_number    ON map_certifications(cert_number);

-- ── GAI Annual Snapshots — Global Adherence Index published country profiles ──
-- One row per (gai_year, country_iso2). Upserted by compute-snapshot endpoint.
-- is_published=1 makes the row available to the public GAI dashboard endpoint.
CREATE TABLE IF NOT EXISTS gai_annual_snapshots (
  snapshot_id    TEXT PRIMARY KEY,
  gai_year       INTEGER NOT NULL,
  country_iso2   TEXT NOT NULL,
  country_name   TEXT NOT NULL,
  n_assessments  INTEGER,
  pe_mean        REAL,
  arch_mean      REAL,
  exec_mean      REAL,
  ctx_mean       REAL,
  dominant_domain TEXT,
  risk_pct_high  REAL,
  risk_pct_amber REAL,
  risk_pct_green REAL,
  conditions_json TEXT,
  created_at     INTEGER NOT NULL,
  is_published   INTEGER DEFAULT 0,
  UNIQUE(gai_year, country_iso2)
);
CREATE INDEX IF NOT EXISTS idx_gai_year    ON gai_annual_snapshots(gai_year);
CREATE INDEX IF NOT EXISTS idx_gai_country ON gai_annual_snapshots(country_iso2);

-- ── Open Data Access Requests — researcher/academic download access control ──
-- Approved manually by admin via POST /api/v1/admin/open-data/approve/:requestId.
-- token is a 30-day bearer used exclusively against GET /api/v1/open-data/download.
CREATE TABLE IF NOT EXISTS open_data_requests (
  request_id     TEXT PRIMARY KEY,
  requester_name TEXT NOT NULL,
  institution    TEXT NOT NULL,
  email          TEXT NOT NULL,
  purpose        TEXT NOT NULL,
  approved       INTEGER DEFAULT 0,
  token          TEXT,
  token_expires  INTEGER,
  created_at     INTEGER NOT NULL
);
