-- ============================================================
-- Migration 016: Licences v2 — Entity-type model,
--                approved categories, document storage,
--                verification workflow, soft-archive
-- FertiLedger ERP
-- ============================================================

-- ── New ENUMs ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE licence_entity_type_enum AS ENUM (
    'ORGANISATION',
    'PARTY',
    'BRANCH',
    'LOCATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE licence_verification_status_enum AS ENUM (
    'UNVERIFIED',
    'PENDING_VERIFICATION',
    'VERIFIED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE licence_status_enum AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'SUSPENDED',
    'CANCELLED',
    'PENDING_RENEWAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Expand licence_type_enum ──────────────────────────────────
DO $$ BEGIN
  ALTER TYPE licence_type_enum ADD VALUE IF NOT EXISTS 'FERTILIZER_WHOLESALE';
  ALTER TYPE licence_type_enum ADD VALUE IF NOT EXISTS 'FERTILIZER_RETAIL';
  ALTER TYPE licence_type_enum ADD VALUE IF NOT EXISTS 'INSECTICIDE';
  ALTER TYPE licence_type_enum ADD VALUE IF NOT EXISTS 'STORAGE';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── Expand licences table ─────────────────────────────────────
ALTER TABLE licences
  -- Entity linkage (replaces nullable party_id / location_id approach)
  -- entity_type + entity_id = polymorphic association
  ADD COLUMN IF NOT EXISTS entity_type            licence_entity_type_enum  NOT NULL DEFAULT 'ORGANISATION',
  ADD COLUMN IF NOT EXISTS entity_id              UUID,             -- points to org/party/branch/location

  -- Issuing authority & coverage
  ADD COLUMN IF NOT EXISTS issuing_authority       TEXT,            -- e.g. 'District Agriculture Officer, Pune'
  ADD COLUMN IF NOT EXISTS approved_premises       TEXT,            -- address of approved premises
  ADD COLUMN IF NOT EXISTS approved_categories     TEXT[],          -- array of product categories covered

  -- Renewal management
  ADD COLUMN IF NOT EXISTS renewal_reminder_days   SMALLINT        NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS renewal_submitted_date  DATE,
  ADD COLUMN IF NOT EXISTS renewal_ref             TEXT,

  -- Document storage (private Supabase Storage bucket)
  -- Path format: licences/{tenant_id}/{licence_id}/{filename}
  ADD COLUMN IF NOT EXISTS document_storage_path   TEXT,
  ADD COLUMN IF NOT EXISTS document_file_name      TEXT,
  ADD COLUMN IF NOT EXISTS document_uploaded_at    TIMESTAMPTZ,

  -- Verification workflow
  ADD COLUMN IF NOT EXISTS verification_status     licence_verification_status_enum NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS verified_by             UUID            REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes      TEXT,

  -- Status
  ADD COLUMN IF NOT EXISTS status                  licence_status_enum      NOT NULL DEFAULT 'ACTIVE',

  -- Soft archive
  ADD COLUMN IF NOT EXISTS is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at             TIMESTAMPTZ,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by              UUID            REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by              UUID            REFERENCES auth.users(id);

-- ── Backfill entity_type from existing data ──────────────────
-- If party_id is set → entity is PARTY. If location_id → LOCATION. Else ORGANISATION.
DO $$
BEGIN
  UPDATE licences SET entity_type = 'PARTY',   entity_id = party_id    WHERE party_id IS NOT NULL;
  UPDATE licences SET entity_type = 'LOCATION', entity_id = location_id WHERE location_id IS NOT NULL AND party_id IS NULL;
  -- Remaining are ORGANISATION-level licences
END $$;

-- ── Status computation — sync from valid_to date ─────────────
DO $$
BEGIN
  UPDATE licences SET status = 'EXPIRED'
  WHERE valid_to < CURRENT_DATE AND status = 'ACTIVE';
END $$;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_licences_entity
  ON licences(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_licences_expiry
  ON licences(tenant_id, organisation_id, valid_to, status);

CREATE INDEX IF NOT EXISTS idx_licences_active
  ON licences(tenant_id, organisation_id, is_active, status);

-- ── updated_at trigger ────────────────────────────────────────
DROP TRIGGER IF EXISTS set_licences_updated_at ON licences;
CREATE TRIGGER set_licences_updated_at
  BEFORE UPDATE ON licences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Helper: get expiring licences ────────────────────────────
-- Returns licences expiring within N days for a given tenant/org.
CREATE OR REPLACE FUNCTION public.get_expiring_licences(
  p_tenant_id       UUID,
  p_organisation_id UUID,
  p_days            INTEGER DEFAULT 30
)
RETURNS TABLE (
  id              UUID,
  licence_number  TEXT,
  licence_type    TEXT,
  entity_type     TEXT,
  entity_id       UUID,
  valid_to        DATE,
  days_remaining  INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    licence_number,
    licence_type::TEXT,
    entity_type::TEXT,
    entity_id,
    valid_to,
    (valid_to - CURRENT_DATE)::INTEGER AS days_remaining
  FROM licences
  WHERE tenant_id       = p_tenant_id
    AND organisation_id = p_organisation_id
    AND is_active       = TRUE
    AND status          NOT IN ('CANCELLED', 'SUSPENDED')
    AND valid_to >= CURRENT_DATE
    AND valid_to <= (CURRENT_DATE + p_days * INTERVAL '1 day')
  ORDER BY valid_to ASC;
$$;
