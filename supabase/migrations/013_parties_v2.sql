-- ============================================================
-- Migration 013: Parties v2 — Multi-role, GST status,
--                credit terms, FMS identifiers, soft-archive
-- FertiLedger ERP
-- ============================================================

-- ── New ENUMs ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE gst_status_enum AS ENUM (
    'REGULAR',
    'COMPOSITION',
    'UNREGISTERED',
    'EXEMPT',
    'SUSPENDED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agri_licence_status_enum AS ENUM (
    'LICENSED',
    'PENDING',
    'EXPIRED',
    'SUSPENDED',
    'NOT_PROVIDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Expand parties table ──────────────────────────────────────
ALTER TABLE parties
  -- Party identity
  ADD COLUMN IF NOT EXISTS code                   TEXT,            -- unique short code per org
  ADD COLUMN IF NOT EXISTS alias                  TEXT,            -- trade name / DBA

  -- Multi-role boolean flags (replace single party_type enum for new records)
  -- party_type column kept for backwards compatibility with existing data
  ADD COLUMN IF NOT EXISTS is_customer            BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_supplier            BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_cf_agent            BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_transporter         BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_wholesaler_licensed BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_retailer_licensed   BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_institutional       BOOLEAN         NOT NULL DEFAULT FALSE,

  -- GST profile
  ADD COLUMN IF NOT EXISTS gst_status             gst_status_enum  NOT NULL DEFAULT 'UNREGISTERED',
  ADD COLUMN IF NOT EXISTS pan                    TEXT,
  ADD COLUMN IF NOT EXISTS state_code             CHAR(2),
  ADD COLUMN IF NOT EXISTS place_of_supply        CHAR(2),

  -- Agriculture licence (computed status — updated by trigger on licences table in Phase 5)
  ADD COLUMN IF NOT EXISTS agri_licence_status    agri_licence_status_enum NOT NULL DEFAULT 'NOT_PROVIDED',

  -- Credit terms
  ADD COLUMN IF NOT EXISTS credit_limit           NUMERIC(15,2)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temp_credit_limit      NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS temp_credit_expiry     DATE,
  ADD COLUMN IF NOT EXISTS credit_days            SMALLINT        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms_text     TEXT,

  -- Contact
  ADD COLUMN IF NOT EXISTS alt_phone              TEXT,
  ADD COLUMN IF NOT EXISTS website                TEXT,

  -- FMS / iFMS identifiers
  ADD COLUMN IF NOT EXISTS fms_dealer_id          TEXT,
  ADD COLUMN IF NOT EXISTS fms_retailer_id        TEXT,

  -- Accounting linkage (FKs will be added in Phase 6 when accounts table exists)
  -- Stored as UUID now; FK constraint added in 022_accounting_engine.sql
  ADD COLUMN IF NOT EXISTS receivable_account_id  UUID,
  ADD COLUMN IF NOT EXISTS payable_account_id     UUID,

  -- Soft archive
  ADD COLUMN IF NOT EXISTS is_active              BOOLEAN         NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at            TIMESTAMPTZ,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by             UUID            REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by             UUID            REFERENCES auth.users(id);

-- ── Party code uniqueness ────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_code_org
  ON parties(tenant_id, organisation_id, code)
  WHERE code IS NOT NULL;

-- ── Full-text / trigram search on party name ─────────────────
CREATE INDEX IF NOT EXISTS idx_parties_name_trgm
  ON parties USING gin(name gin_trgm_ops);

-- ── GSTIN uniqueness — only for registered parties ───────────
-- Existing unique(tenant_id, organisation_id, gstin) from 006 already handles this.

-- ── Active parties index ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_parties_active
  ON parties(tenant_id, organisation_id, is_active, party_type);

-- ── Helper: sync multi-role flags from legacy party_type ─────
-- Run this once after migration to backfill is_customer / is_supplier flags
-- for existing data that used the party_type enum.
DO $$
BEGIN
  UPDATE parties SET is_customer = TRUE WHERE party_type IN ('CUSTOMER', 'BOTH');
  UPDATE parties SET is_supplier = TRUE WHERE party_type IN ('SUPPLIER', 'BOTH');
  UPDATE parties SET is_cf_agent = TRUE WHERE party_type = 'CF_AGENT';
END $$;
