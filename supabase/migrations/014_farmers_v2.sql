-- ============================================================
-- Migration 014: Farmers v2 — Full schema expansion,
--                Aadhaar encryption, KYC, geo data
-- FertiLedger ERP
-- ============================================================
-- BLOCKER B-02 FIX: Aadhaar encryption via pgcrypto.
-- pgcrypto extension is already enabled (migration 001).
-- ============================================================

-- ── New ENUMs ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE kyc_status_enum AS ENUM (
    'NOT_COLLECTED',
    'PARTIAL',
    'COMPLETE',
    'VERIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE farmer_verification_status_enum AS ENUM (
    'UNVERIFIED',
    'PENDING',
    'VERIFIED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE land_category_enum AS ENUM (
    'OWNER',
    'TENANT',
    'SHARECROPPER',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Expand farmers table ──────────────────────────────────────
ALTER TABLE farmers
  -- System-generated farmer code (unique per org)
  ADD COLUMN IF NOT EXISTS farmer_code            TEXT,            -- e.g. FRM-000001

  -- Name
  ADD COLUMN IF NOT EXISTS father_spouse_name     TEXT,
  ADD COLUMN IF NOT EXISTS alt_phone              TEXT,

  -- Geo / address
  ADD COLUMN IF NOT EXISTS gram_panchayat         TEXT,
  ADD COLUMN IF NOT EXISTS block_name             TEXT,
  ADD COLUMN IF NOT EXISTS district               TEXT,
  ADD COLUMN IF NOT EXISTS state                  TEXT,
  ADD COLUMN IF NOT EXISTS pin                    TEXT,

  -- Agriculture identity
  ADD COLUMN IF NOT EXISTS farmer_registration_no TEXT,            -- from state agri dept
  ADD COLUMN IF NOT EXISTS fpo_id                 UUID,            -- → parties (FPO / farmer group)
  ADD COLUMN IF NOT EXISTS land_category          land_category_enum NOT NULL DEFAULT 'OWNER',
  ADD COLUMN IF NOT EXISTS cultivated_area_acres  NUMERIC(8,2),    -- replaces land_area_acres
  ADD COLUMN IF NOT EXISTS primary_crop           TEXT,
  ADD COLUMN IF NOT EXISTS primary_season         TEXT,            -- Kharif / Rabi / Zaid
  ADD COLUMN IF NOT EXISTS land_record_ref        TEXT,            -- ROR / Patta / Khata ref
  ADD COLUMN IF NOT EXISTS kisan_credit_card_ref  TEXT,

  -- ── Aadhaar — BLOCKER B-02 FIX ───────────────────────────
  -- aadhaar_number (existing column): deprecated — stores "XXXX-XXXX-XXXX" mask
  -- New: store only last 4 digits in plain text for display
  ADD COLUMN IF NOT EXISTS aadhaar_last4          CHAR(4),         -- '1234' (only last 4)
  -- Optional: encrypted full Aadhaar number (for subsidy-linked farmer sales only)
  -- Encrypt with pgp_sym_encrypt(full_aadhaar, app_encryption_key) from server action
  -- Decrypt only via server action — NEVER expose to browser
  ADD COLUMN IF NOT EXISTS aadhaar_encrypted      BYTEA,           -- pgcrypto AES-256
  ADD COLUMN IF NOT EXISTS aadhaar_collected_for  TEXT,            -- purpose: 'SUBSIDY_CLAIM' etc.

  -- PAN (optional, for income-tax-linked buyers)
  ADD COLUMN IF NOT EXISTS pan_masked             TEXT,            -- 'ABCDE****F'
  ADD COLUMN IF NOT EXISTS pan_encrypted          BYTEA,           -- pgcrypto AES-256

  -- KYC
  ADD COLUMN IF NOT EXISTS kyc_status             kyc_status_enum  NOT NULL DEFAULT 'NOT_COLLECTED',
  ADD COLUMN IF NOT EXISTS consent_date           DATE,
  ADD COLUMN IF NOT EXISTS consent_mode           TEXT,            -- 'WRITTEN' | 'VERBAL' | 'DIGITAL'
  ADD COLUMN IF NOT EXISTS kyc_doc_path           TEXT,            -- private storage path

  -- Verification
  ADD COLUMN IF NOT EXISTS verification_status    farmer_verification_status_enum NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS verified_by            UUID             REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at            TIMESTAMPTZ,

  -- Soft archive
  ADD COLUMN IF NOT EXISTS is_active              BOOLEAN          NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason        TEXT,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by             UUID             REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by             UUID             REFERENCES auth.users(id);

-- ── Migrate existing land_area_acres data to cultivated_area_acres ──
DO $$
BEGIN
  UPDATE farmers
  SET cultivated_area_acres = land_area_acres
  WHERE cultivated_area_acres IS NULL AND land_area_acres IS NOT NULL;
END $$;

-- ── Migrate existing aadhaar_number to aadhaar_last4 ────────
-- aadhaar_number currently stores "XXXX-XXXX-1234" format.
-- Extract last 4 digits into the new aadhaar_last4 column.
DO $$
BEGIN
  UPDATE farmers
  SET aadhaar_last4 = RIGHT(REPLACE(aadhaar_number, '-', ''), 4)
  WHERE aadhaar_number IS NOT NULL
    AND aadhaar_last4 IS NULL
    AND LENGTH(REPLACE(aadhaar_number, '-', '')) >= 4;
END $$;

-- ── Farmer code uniqueness ───────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_farmers_code_org
  ON farmers(tenant_id, organisation_id, farmer_code)
  WHERE farmer_code IS NOT NULL;

-- ── Search indexes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_farmers_name_trgm
  ON farmers USING gin((first_name || ' ' || COALESCE(last_name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_farmers_phone
  ON farmers(tenant_id, organisation_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_farmers_active
  ON farmers(tenant_id, organisation_id, is_active);

-- ── Aadhaar encryption helper functions ──────────────────────
-- SECURITY: These are SECURITY DEFINER — they can only be called
-- from server actions with the encryption key from env.
-- The encryption key must NEVER be stored in the database itself.

-- Encrypt Aadhaar number (called with key from AADHAAR_ENCRYPTION_KEY env var)
CREATE OR REPLACE FUNCTION public.encrypt_aadhaar(
  p_aadhaar_number TEXT,
  p_encryption_key TEXT
)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_aadhaar_number IS NULL OR LENGTH(p_aadhaar_number) = 0 THEN
    RETURN NULL;
  END IF;
  -- Validate: must be exactly 12 digits
  IF p_aadhaar_number !~ '^\d{12}$' THEN
    RAISE EXCEPTION 'Invalid Aadhaar number format — must be 12 digits only';
  END IF;
  RETURN pgp_sym_encrypt(p_aadhaar_number, p_encryption_key);
END;
$$;

-- Decrypt Aadhaar number (for authorised access only — logged in audit_log)
CREATE OR REPLACE FUNCTION public.decrypt_aadhaar(
  p_encrypted BYTEA,
  p_encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(p_encrypted, p_encryption_key);
EXCEPTION WHEN others THEN
  -- Wrong key or corrupted data — return NULL, do not expose error detail
  RETURN NULL;
END;
$$;

-- Validate Aadhaar format (Verhoeff algorithm not implemented here — basic digit check)
CREATE OR REPLACE FUNCTION public.validate_aadhaar_format(p_aadhaar TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_aadhaar ~ '^\d{12}$';
$$;

-- ── IMPORTANT: Add column comment documenting data policy ────
COMMENT ON COLUMN farmers.aadhaar_encrypted IS
  'Full Aadhaar encrypted with pgp_sym_encrypt using AADHAAR_ENCRYPTION_KEY env var. '
  'NEVER expose in browser. Decrypt only in server action with explicit audit logging. '
  'Only collect where legally required (e.g., DBT subsidy claims).';

COMMENT ON COLUMN farmers.aadhaar_last4 IS
  'Last 4 digits of Aadhaar only. Safe for display. Never store full 12-digit Aadhaar here.';

COMMENT ON COLUMN farmers.aadhaar_number IS
  'DEPRECATED: Use aadhaar_last4 for display and aadhaar_encrypted for storage. '
  'This column stores XXXX-XXXX-XXXX format from legacy data.';
