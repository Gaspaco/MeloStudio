-- MeloStudio schema. Run via `bun run db:migrate`.
-- Re-runnable: every statement uses IF NOT EXISTS / OR REPLACE.

-- =========================================================================
-- assets: global, deduped audio file registry. Bytes live in object storage.
-- =========================================================================
CREATE TABLE IF NOT EXISTS assets (
  id            TEXT PRIMARY KEY,                -- sha256 hex of file bytes
  name          TEXT NOT NULL,
  mime          TEXT NOT NULL,
  bytes         BIGINT NOT NULL,
  duration_sec  DOUBLE PRECISION NOT NULL,
  sample_rate   INTEGER NOT NULL,
  channels      SMALLINT NOT NULL CHECK (channels IN (1, 2)),
  storage_key   TEXT NOT NULL,                   -- key in R2/S3
  peaks_key     TEXT,                            -- pre-rendered waveform peaks
  uploaded_by   TEXT,                            -- neon_auth.users_sync.id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON assets (uploaded_by);

-- =========================================================================
-- projects: one row per DAW project. The whole timeline lives in `data` (JSONB).
-- A few columns are denormalized for fast list queries.
-- =========================================================================
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,                     -- neon_auth.users_sync.id
  name        TEXT NOT NULL,
  bpm         REAL NOT NULL DEFAULT 120,
  data        JSONB NOT NULL,                    -- full ProjectDoc
  schema_ver  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_updated
  ON projects (user_id, updated_at DESC);

-- GIN index lets us efficiently search inside the JSONB doc later
-- (e.g. "all projects using asset X" → data @> '{"assets":[{"id":"…"}]}').
CREATE INDEX IF NOT EXISTS idx_projects_data_gin
  ON projects USING GIN (data jsonb_path_ops);

-- =========================================================================
-- project_versions: cheap history for cross-session undo / restore.
-- Append a row on every successful save. Trim to last N per project in a job.
-- =========================================================================
CREATE TABLE IF NOT EXISTS project_versions (
  id          BIGSERIAL PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data        JSONB NOT NULL,
  schema_ver  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_created
  ON project_versions (project_id, created_at DESC);

-- =========================================================================
-- Auto-bump updated_at on UPDATE.
-- =========================================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
