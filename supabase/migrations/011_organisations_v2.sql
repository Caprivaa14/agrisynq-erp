-- ============================================================
-- Migration 011: Organisations v2 — Add FMS/iFMS and
--                compliance fields to organisations table
-- FertiLedger ERP
-- ============================================================

-- ── Add ERP/compliance fields to organisations ───────────────
ALTER TABLE organisations
  -- E-invoice & e-way bill applicability
  ADD COLUMN IF NOT EXISTS einvoice_applicable      BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ewaybill_applicable      BOOLEAN         NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS einvoice_threshold_cr    NUMERIC(10,2),          -- in crores

  -- GST & state
  ADD COLUMN IF NOT EXISTS state_code               CHAR(2),                 -- e.g. '27' for Maharashtra
  ADD COLUMN IF NOT EXISTS default_place_of_supply  CHAR(2),

  -- FMS / iFMS identifiers
  ADD COLUMN IF NOT EXISTS fms_enabled              BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ifms_enabled             BOOLEAN         NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fms_dealer_id            TEXT,
  ADD COLUMN IF NOT EXISTS pos_dealer_id            TEXT,

  -- Agriculture licence numbers (org-level)
  ADD COLUMN IF NOT EXISTS fertilizer_licence_no    TEXT,
  ADD COLUMN IF NOT EXISTS seed_licence_no          TEXT,
  ADD COLUMN IF NOT EXISTS pesticide_licence_no     TEXT,
  ADD COLUMN IF NOT EXISTS insecticide_licence_no   TEXT,

  -- Inventory valuation method
  ADD COLUMN IF NOT EXISTS valuation_method         TEXT            NOT NULL DEFAULT 'FIFO'
                                                    CHECK (valuation_method IN ('FIFO', 'WEIGHTED_AVG')),

  -- Financial year start month (default April = 4)
  ADD COLUMN IF NOT EXISTS fy_start_month           SMALLINT        NOT NULL DEFAULT 4
                                                    CHECK (fy_start_month BETWEEN 1 AND 12),

  -- Contact
  ADD COLUMN IF NOT EXISTS contact_person           TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone            TEXT,
  ADD COLUMN IF NOT EXISTS contact_email            TEXT,

  -- Logo / branding
  ADD COLUMN IF NOT EXISTS logo_storage_path        TEXT,

  -- Bank default (will FK to bank_accounts in Phase 7)
  ADD COLUMN IF NOT EXISTS default_bank_account_id  UUID,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by               UUID            REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by               UUID            REFERENCES auth.users(id);

-- ── updated_at trigger for organisations ──────────────────────
-- Already exists from migration 004 — no need to re-create.

-- ── Add branch-level fields ───────────────────────────────────
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS address                  JSONB,          -- { line1, line2, city, state, pin }
  ADD COLUMN IF NOT EXISTS contact_person           TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone            TEXT,
  ADD COLUMN IF NOT EXISTS invoice_series_prefix    TEXT,
  ADD COLUMN IF NOT EXISTS is_active                BOOLEAN         NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by               UUID            REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by               UUID            REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_branches_org_active ON branches(tenant_id, organisation_id, is_active);
