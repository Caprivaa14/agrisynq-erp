-- ============================================================
-- Migration 026: Farmer Sales & FMS/Subsidy Reconciliation
-- FertiLedger ERP — Phase 5 Sales Engine
-- ============================================================
-- Farmer sales in the fertilizer sector are regulated:
--   - Mandatory PoS (Point of Sale) recording via iFMS/FMS
--   - Aadhaar-linked farmer identification
--   - Subsidy routing through government DBT/FMS
--   - Sales quantity limits per farmer per season
--
-- LEGAL CONSTRAINTS:
--   - Cannot reuse old PoS/FMS transaction codes
--   - Cannot duplicate subsidy claims
--   - FMS reconciliation must match actual sale
--   - Farmer sale without valid PoS = non-compliant
-- ============================================================

DO $$ BEGIN
  CREATE TYPE farmer_sale_status AS ENUM (
    'DRAFT',            -- entry in progress
    'POS_PENDING',      -- sale recorded, PoS/FMS transaction awaited
    'POS_RECORDED',     -- PoS transaction captured from FMS device
    'POSTED',           -- fully finalised, stock reduced, subsidy tracked
    'SUBSIDY_CLAIMED',  -- subsidy claim submitted to government
    'SUBSIDY_RECEIVED', -- subsidy amount received
    'CANCELLED'         -- cancelled (only pre-posting)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subsidy_type_enum AS ENUM (
    'NEEM_COATED_UREA',   -- mandatory NBS/DBT subsidy
    'NBS_FERTILIZER',     -- Nutrient Based Subsidy
    'STATE_SUBSIDY',      -- state government subsidy
    'NONE'                -- no subsidy (non-regulated product)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Farmer Sales ───────────────────────────────────────────────
CREATE TABLE farmer_sales (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID          NOT NULL REFERENCES organisations(id),
  branch_id               UUID          REFERENCES branches(id),

  -- Document
  sale_number             TEXT          NOT NULL,
  sale_date               DATE          NOT NULL DEFAULT CURRENT_DATE,
  season                  TEXT,                           -- KHARIF-2026 / RABI-2026-27
  financial_year          TEXT,                           -- 2026-27

  -- Farmer identity
  farmer_id               UUID          NOT NULL REFERENCES farmers(id),
  farmer_aadhaar_last4    TEXT,                           -- snapshot at time of sale
  farmer_name             TEXT          NOT NULL,          -- snapshot
  farmer_phone            TEXT,

  -- Location
  sale_at_location        UUID          NOT NULL REFERENCES locations(id),
  farmer_village          TEXT,
  farmer_district         TEXT,

  -- Product (single product per farmer sale entry for FMS compliance)
  product_id              UUID          NOT NULL REFERENCES products(id),
  hsn_code                TEXT          NOT NULL,
  batch_id                UUID          REFERENCES batch_register(id),
  batch_number            TEXT,

  -- Quantity
  qty_sold                NUMERIC(15,3) NOT NULL CHECK (qty_sold > 0),
  unit_of_measure         TEXT          NOT NULL,
  pack_size               NUMERIC(10,3),                  -- bags converted to kg if needed

  -- Pricing
  mrp_per_unit            NUMERIC(15,4),
  selling_price_per_unit  NUMERIC(15,4) NOT NULL,
  subsidy_per_unit        NUMERIC(15,4) NOT NULL DEFAULT 0,
  farmer_price_per_unit   NUMERIC(15,4) GENERATED ALWAYS AS (
                            selling_price_per_unit - subsidy_per_unit
                          ) STORED,                       -- what farmer actually pays

  -- Financial
  gross_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_subsidy_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  farmer_payable_amount   NUMERIC(15,2) NOT NULL DEFAULT 0, -- farmer_price * qty
  gst_rate                NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount              NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Payment from farmer
  cash_received           NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit_amount           NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Subsidy details
  subsidy_type            subsidy_type_enum NOT NULL DEFAULT 'NONE',
  subsidy_scheme          TEXT,                           -- scheme name / notification ref
  subsidy_rate_per_unit   NUMERIC(15,4) NOT NULL DEFAULT 0,

  -- FMS / PoS integration
  fms_dealer_id           TEXT,                           -- dealer code in FMS system
  fms_product_code        TEXT,                           -- product code in FMS
  pos_transaction_id      TEXT,                           -- PoS device transaction ID (UNIQUE)
  pos_recorded_at         TIMESTAMPTZ,
  pos_device_id           TEXT,                           -- device serial / terminal ID
  fms_acknowledgement_no  TEXT,                           -- FMS server acknowledgement
  fms_synced_at           TIMESTAMPTZ,

  -- Status
  status                  farmer_sale_status NOT NULL DEFAULT 'DRAFT',
  posted_at               TIMESTAMPTZ,
  posted_by               UUID          REFERENCES auth.users(id),

  -- Link to regular sales invoice (if applicable)
  invoice_id              UUID          REFERENCES sales_invoices(id),

  narration               TEXT,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          REFERENCES auth.users(id),
  updated_by              UUID          REFERENCES auth.users(id),

  CONSTRAINT fs_number_unique UNIQUE (tenant_id, organisation_id, sale_number),
  -- CRITICAL: PoS transaction IDs must be unique across the tenant
  -- Prevents reuse of old PoS/FMS transaction codes (duplicate subsidy prevention)
  CONSTRAINT pos_tx_unique UNIQUE (tenant_id, pos_transaction_id)
    DEFERRABLE INITIALLY DEFERRED
);

-- ── FMS Reconciliation ─────────────────────────────────────────
-- Tracks the reconciliation between FMS/iFMS server records
-- and actual recorded farmer sales
CREATE TABLE fms_reconciliation (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID          NOT NULL REFERENCES organisations(id),

  reconciliation_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
  period_from             DATE          NOT NULL,
  period_to               DATE          NOT NULL,
  fms_dealer_id           TEXT          NOT NULL,
  fms_product_code        TEXT,

  -- FMS server data (downloaded)
  fms_total_qty           NUMERIC(15,3) NOT NULL DEFAULT 0,
  fms_total_transactions  INTEGER       NOT NULL DEFAULT 0,
  fms_total_subsidy       NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- System data (from farmer_sales)
  system_total_qty        NUMERIC(15,3) NOT NULL DEFAULT 0,
  system_total_transactions INTEGER     NOT NULL DEFAULT 0,
  system_total_subsidy    NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Variance (auto-computed)
  qty_variance            NUMERIC(15,3) GENERATED ALWAYS AS (fms_total_qty - system_total_qty) STORED,
  subsidy_variance        NUMERIC(15,2) GENERATED ALWAYS AS (fms_total_subsidy - system_total_subsidy) STORED,

  -- Status
  reconciliation_status   TEXT          NOT NULL DEFAULT 'PENDING',  -- PENDING / MATCHED / VARIANCE / RESOLVED
  remarks                 TEXT,
  resolved_by             UUID          REFERENCES auth.users(id),
  resolved_at             TIMESTAMPTZ,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          REFERENCES auth.users(id)
);

-- ── Subsidy Claim Register ─────────────────────────────────────
CREATE TABLE subsidy_claims (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID          NOT NULL REFERENCES organisations(id),

  claim_number            TEXT          NOT NULL,
  claim_date              DATE          NOT NULL DEFAULT CURRENT_DATE,
  period_from             DATE          NOT NULL,
  period_to               DATE          NOT NULL,
  subsidy_type            subsidy_type_enum NOT NULL,
  scheme_name             TEXT,

  -- Claim amounts
  total_qty_claimed       NUMERIC(15,3) NOT NULL DEFAULT 0,
  total_subsidy_claimed   NUMERIC(15,2) NOT NULL DEFAULT 0,
  subsidy_received        NUMERIC(15,2) NOT NULL DEFAULT 0,
  subsidy_pending         NUMERIC(15,2) GENERATED ALWAYS AS (total_subsidy_claimed - subsidy_received) STORED,

  -- Status
  claim_status            TEXT          NOT NULL DEFAULT 'DRAFT',  -- DRAFT / SUBMITTED / PARTIALLY_RECEIVED / FULLY_RECEIVED / REJECTED
  submitted_on            DATE,
  government_ref_no       TEXT,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          REFERENCES auth.users(id),

  CONSTRAINT sc_number_unique UNIQUE (tenant_id, organisation_id, claim_number)
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE farmer_sales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fms_reconciliation   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidy_claims       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fs_tenant_select"  ON farmer_sales       FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "fs_tenant_insert"  ON farmer_sales       FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "fs_draft_update"   ON farmer_sales       FOR UPDATE USING (tenant_id = public.get_tenant_id() AND status IN ('DRAFT','POS_PENDING','POS_RECORDED'));
CREATE POLICY "fs_no_delete"      ON farmer_sales       FOR DELETE USING (FALSE);

CREATE POLICY "fms_tenant_select" ON fms_reconciliation FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "fms_tenant_insert" ON fms_reconciliation FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "fms_tenant_update" ON fms_reconciliation FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "fms_no_delete"     ON fms_reconciliation FOR DELETE USING (FALSE);

CREATE POLICY "sc_tenant_select"  ON subsidy_claims     FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sc_tenant_insert"  ON subsidy_claims     FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "sc_tenant_update"  ON subsidy_claims     FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sc_no_delete"      ON subsidy_claims     FOR DELETE USING (FALSE);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_fs_farmer   ON farmer_sales(farmer_id, sale_date DESC);
CREATE INDEX idx_fs_product  ON farmer_sales(product_id, sale_date DESC);
CREATE INDEX idx_fs_status   ON farmer_sales(tenant_id, status);
CREATE INDEX idx_fs_season   ON farmer_sales(tenant_id, season, financial_year);
CREATE INDEX idx_fs_fms      ON farmer_sales(tenant_id, fms_dealer_id, fms_product_code);
CREATE INDEX idx_fms_period  ON fms_reconciliation(tenant_id, period_from, period_to);

CREATE TRIGGER set_fs_updated_at BEFORE UPDATE ON farmer_sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Auto-number ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_fs_number(p_tenant_id UUID, p_org_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year TEXT := TO_CHAR(CURRENT_DATE,'YYYY'); v_count INTEGER;
BEGIN
  SELECT COUNT(*)+1 INTO v_count FROM farmer_sales
   WHERE tenant_id=p_tenant_id AND organisation_id=p_org_id AND sale_number LIKE 'FS-'||v_year||'-%';
  RETURN 'FS-'||v_year||'-'||LPAD(v_count::TEXT,5,'0');
END; $$;

-- ── Season/Quantity Guard ─────────────────────────────────────
-- Prevent selling more than allowed per farmer per product per season
-- This is a soft check — a trigger for advisory warning, not hard block
-- (Hard limits should be configured via licence/compliance settings)
CREATE OR REPLACE FUNCTION public.get_farmer_season_qty(
  p_tenant_id UUID,
  p_farmer_id UUID,
  p_product_id UUID,
  p_season TEXT
)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE(SUM(qty_sold), 0)
    FROM farmer_sales
   WHERE tenant_id  = p_tenant_id
     AND farmer_id  = p_farmer_id
     AND product_id = p_product_id
     AND season     = p_season
     AND status NOT IN ('CANCELLED', 'DRAFT');
$$;
