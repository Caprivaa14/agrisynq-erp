-- ============================================================
-- Migration 019: Batch Register
-- FertiLedger ERP — Phase 3 Inventory Engine
-- ============================================================
-- Every unit of stock in FertiLedger belongs to a batch.
-- A batch ties a specific product + supplier + purchase + location
-- together with manufacture and expiry dates.
--
-- FIFO is the default valuation method.
-- Weighted-average is supported via the organisation setting.
-- ============================================================

-- ── ENUMs ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE batch_status_enum AS ENUM (
    'OPEN',          -- stock still available
    'CLOSED',        -- fully consumed
    'QUARANTINE',    -- held pending quality check
    'EXPIRED',       -- past expiry date
    'RECALLED'       -- product recall / quality issue
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE opening_stock_reason_enum AS ENUM (
    'SYSTEM_OPENING',     -- migration / go-live opening
    'PERIOD_OPENING',     -- new financial year
    'RECOUNT_CORRECTION', -- physical count correction
    'DAMAGED_RETURN',     -- returned from field, recounted
    'QUARANTINE_RELEASE'  -- released from quarantine
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Batch Register ────────────────────────────────────────────
CREATE TABLE batch_register (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id       UUID          NOT NULL REFERENCES organisations(id),
  branch_id             UUID          REFERENCES branches(id),

  -- Product & batch identity
  batch_number          TEXT          NOT NULL,              -- supplier batch / mfr lot number
  internal_batch_ref    TEXT,                               -- internal system batch reference
  product_id            UUID          NOT NULL REFERENCES products(id),

  -- Source of this batch
  -- (purchase_invoice_id will FK to purchase_invoices in Phase 4)
  purchase_invoice_id   UUID,                               -- placeholder
  supplier_id           UUID          REFERENCES parties(id),
  received_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Location this batch was received into
  location_id           UUID          NOT NULL REFERENCES locations(id),

  -- Quantity
  opening_qty           NUMERIC(15,3) NOT NULL CHECK (opening_qty >= 0),
  current_qty           NUMERIC(15,3) NOT NULL CHECK (current_qty >= 0),
  unit_of_measure       TEXT          NOT NULL,             -- must match products.unit_of_measure

  -- Cost (for FIFO / weighted-average valuation)
  purchase_rate         NUMERIC(15,4) NOT NULL DEFAULT 0,  -- per unit, excluding GST
  purchase_rate_with_tax NUMERIC(15,4) NOT NULL DEFAULT 0, -- per unit, inclusive of GST
  landing_cost_per_unit NUMERIC(15,4) NOT NULL DEFAULT 0,  -- after freight + charges

  -- Manufacture & expiry
  manufacture_date      DATE,
  expiry_date           DATE,
  shelf_life_days       SMALLINT,                          -- calculated from manufacture+expiry

  -- Status
  status                batch_status_enum NOT NULL DEFAULT 'OPEN',

  -- Quality / quarantine
  quarantine_reason     TEXT,
  quarantine_date       DATE,
  released_date         DATE,

  -- FMS / subsidy
  pos_batch_ref         TEXT,                              -- PoS terminal batch reference
  fms_batch_code        TEXT,                              -- iFMS batch reference

  -- Audit
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id),
  updated_by            UUID          REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT batch_qty_consistent CHECK (current_qty <= opening_qty),
  CONSTRAINT expiry_after_manufacture CHECK (
    expiry_date IS NULL OR manufacture_date IS NULL
    OR expiry_date >= manufacture_date
  )
);

-- RLS
ALTER TABLE batch_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batch_tenant_select" ON batch_register
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "batch_tenant_insert" ON batch_register
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "batch_tenant_update" ON batch_register
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "batch_no_delete" ON batch_register
  FOR DELETE USING (FALSE);  -- immutable inventory record

-- Indexes
CREATE UNIQUE INDEX idx_batch_number_product_org
  ON batch_register(tenant_id, organisation_id, product_id, batch_number);

CREATE INDEX idx_batch_product     ON batch_register(product_id, status);
CREATE INDEX idx_batch_location    ON batch_register(location_id, status);
CREATE INDEX idx_batch_supplier    ON batch_register(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_batch_expiry      ON batch_register(expiry_date, status) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_batch_fms         ON batch_register(fms_batch_code) WHERE fms_batch_code IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER set_batch_updated_at
  BEFORE UPDATE ON batch_register
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Batch Status Auto-update ──────────────────────────────────
-- Mark batches CLOSED when current_qty reaches 0
CREATE OR REPLACE FUNCTION public.auto_close_batch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_qty = 0 AND OLD.current_qty > 0 THEN
    NEW.status := 'CLOSED';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER batch_auto_close
  BEFORE UPDATE ON batch_register
  FOR EACH ROW EXECUTE FUNCTION public.auto_close_batch();

-- ── Helper: Get available batches for FIFO picking ────────────
-- Returns open batches for a product+location ordered oldest first (FIFO)
CREATE OR REPLACE FUNCTION public.get_fifo_batches(
  p_tenant_id    UUID,
  p_product_id   UUID,
  p_location_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  batch_number    TEXT,
  location_id     UUID,
  current_qty     NUMERIC,
  expiry_date     DATE,
  landing_cost_per_unit NUMERIC,
  received_at     TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id, batch_number, location_id, current_qty, expiry_date,
         landing_cost_per_unit, received_at
  FROM   batch_register
  WHERE  tenant_id   = p_tenant_id
    AND  product_id  = p_product_id
    AND  status      = 'OPEN'
    AND  current_qty > 0
    AND  (p_location_id IS NULL OR location_id = p_location_id)
  ORDER BY received_at ASC, expiry_date ASC NULLS LAST;
$$;

-- ── Helper: Get expiring batches ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_expiring_batches(
  p_tenant_id       UUID,
  p_organisation_id UUID,
  p_days            INTEGER DEFAULT 30
)
RETURNS TABLE (
  id            UUID,
  batch_number  TEXT,
  product_id    UUID,
  location_id   UUID,
  current_qty   NUMERIC,
  expiry_date   DATE,
  days_remaining INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id, batch_number, product_id, location_id, current_qty, expiry_date,
         (expiry_date - CURRENT_DATE)::INTEGER AS days_remaining
  FROM   batch_register
  WHERE  tenant_id       = p_tenant_id
    AND  organisation_id = p_organisation_id
    AND  status          = 'OPEN'
    AND  current_qty     > 0
    AND  expiry_date     IS NOT NULL
    AND  expiry_date     BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days * INTERVAL '1 day')
  ORDER BY expiry_date ASC;
$$;
