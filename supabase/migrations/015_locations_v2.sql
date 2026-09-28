-- ============================================================
-- Migration 015: Locations v2 — 11 location types,
--                ownership/custody model, soft-archive
-- FertiLedger ERP
-- ============================================================

-- ── Expand location_type_enum ────────────────────────────────
-- Current values: OWN, CF_DEPOT, QUARANTINE, VIRTUAL
-- Add 7 new values
DO $$ BEGIN
  ALTER TYPE location_type_enum ADD VALUE IF NOT EXISTS 'BRANCH_WAREHOUSE';
  ALTER TYPE location_type_enum ADD VALUE IF NOT EXISTS 'COMPANY_DEPOT';
  ALTER TYPE location_type_enum ADD VALUE IF NOT EXISTS 'THIRD_PARTY';
  ALTER TYPE location_type_enum ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
  ALTER TYPE location_type_enum ADD VALUE IF NOT EXISTS 'DAMAGED';
  ALTER TYPE location_type_enum ADD VALUE IF NOT EXISTS 'EXPIRED';
  ALTER TYPE location_type_enum ADD VALUE IF NOT EXISTS 'CUSTOMER_CONSIGNMENT';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Rename OWN → OWN_WAREHOUSE for clarity (create value, backfill later — can't rename enum value in PG < 15)
-- For now, OWN remains valid and is treated as OWN_WAREHOUSE in application layer

-- ── New ENUMs ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE location_ownership_enum AS ENUM (
    'OWN',
    'CF_AGENT',
    'COMPANY',           -- manufacturer / company depot
    'THIRD_PARTY',
    'GOVERNMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Expand locations table ────────────────────────────────────
ALTER TABLE locations
  -- Location code (unique per org, short reference)
  ADD COLUMN IF NOT EXISTS code                           TEXT,

  -- Ownership and custody model
  ADD COLUMN IF NOT EXISTS ownership                      location_ownership_enum  NOT NULL DEFAULT 'OWN',
  ADD COLUMN IF NOT EXISTS custodian_party_id             UUID                     REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS branch_id                      UUID                     REFERENCES branches(id),

  -- GST / compliance
  ADD COLUMN IF NOT EXISTS gst_state                      TEXT,
  ADD COLUMN IF NOT EXISTS gstin_of_location              TEXT,
  ADD COLUMN IF NOT EXISTS licence_no                     TEXT,             -- licence covering this location

  -- Contact
  ADD COLUMN IF NOT EXISTS contact_person                 TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone                  TEXT,

  -- C&F / stock confirmation
  ADD COLUMN IF NOT EXISTS stock_confirmation_freq_days   SMALLINT          DEFAULT 30,

  -- Soft archive
  ADD COLUMN IF NOT EXISTS is_active                      BOOLEAN           NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at                    TIMESTAMPTZ,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by                     UUID              REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by                     UUID              REFERENCES auth.users(id);

-- ── Location code uniqueness ─────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_code_org
  ON locations(tenant_id, organisation_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_active
  ON locations(tenant_id, organisation_id, is_active);

CREATE INDEX IF NOT EXISTS idx_locations_custodian
  ON locations(custodian_party_id)
  WHERE custodian_party_id IS NOT NULL;

-- ── updated_at trigger ────────────────────────────────────────
DROP TRIGGER IF EXISTS set_locations_updated_at ON locations;
CREATE TRIGGER set_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
