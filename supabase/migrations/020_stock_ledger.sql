-- ============================================================
-- Migration 020: Stock Ledger
-- FertiLedger ERP — Phase 3 Inventory Engine
-- ============================================================
-- The stock_ledger is the IMMUTABLE audit trail of all stock
-- movements. Every quantity change is an INSERT-only entry.
-- Current stock balance is computed by summing entries.
--
-- CARDINAL RULE: Never UPDATE or DELETE from stock_ledger.
-- Corrections must be done as new reversal entries.
-- ============================================================

-- ── Movement Type ENUM ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM (
    -- Inbound
    'GRN',               -- Goods Receipt Note (purchase receipt)
    'OPENING',           -- Opening stock entry
    'RETURN_FROM_SALE',  -- Sales return
    'TRANSFER_IN',       -- Transfer received from another location
    'QUARANTINE_RELEASE',-- Released from quarantine

    -- Outbound
    'SALE',              -- Sales invoice
    'RETURN_TO_SUPPLIER',-- Purchase return
    'TRANSFER_OUT',      -- Transfer sent to another location
    'QUARANTINE_HOLD',   -- Moved to quarantine

    -- Adjustments (require period-lock check)
    'ADJ_INCREASE',      -- Physical count — excess
    'ADJ_DECREASE',      -- Physical count — shortage
    'EXPIRY_WRITE_OFF',  -- Expired stock write-off
    'DAMAGE_WRITE_OFF',  -- Damaged stock write-off

    -- FMS / Subsidy
    'FMS_SUBSIDY_OUT',   -- Subsidised sale via FMS/PoS
    'FMS_RETURN'         -- FMS return / reversal
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Stock Ledger (INSERT-ONLY) ────────────────────────────────
CREATE TABLE stock_ledger (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id       UUID          NOT NULL REFERENCES organisations(id),
  branch_id             UUID          REFERENCES branches(id),

  -- Movement identity
  movement_type         stock_movement_type NOT NULL,
  movement_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  movement_ts           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Product & batch
  product_id            UUID          NOT NULL REFERENCES products(id),
  batch_id              UUID          REFERENCES batch_register(id),

  -- Location
  from_location_id      UUID          REFERENCES locations(id),
  to_location_id        UUID          REFERENCES locations(id),
  -- For a simple in/out, use to_location_id only (from_location_id = NULL for GRN)
  -- For transfers, both must be set

  -- Quantity (always positive; direction implied by movement_type)
  qty                   NUMERIC(15,3) NOT NULL CHECK (qty > 0),
  unit_of_measure       TEXT          NOT NULL,

  -- Valuation
  rate_per_unit         NUMERIC(15,4) NOT NULL DEFAULT 0,  -- ex-GST
  taxable_amount        NUMERIC(15,2) GENERATED ALWAYS AS (qty * rate_per_unit) STORED,
  gst_rate              NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(15,2) GENERATED ALWAYS AS (qty * rate_per_unit) STORED,

  -- Source document linkage
  -- (FK constraints added in later phases when those tables exist)
  source_document_type  TEXT,         -- 'PURCHASE_INVOICE' | 'SALE_INVOICE' | 'ADJUSTMENT' | 'TRANSFER' | 'FMS'
  source_document_id    UUID,         -- points to the source document
  source_document_no    TEXT,         -- human-readable ref (e.g. invoice number)

  -- Party (for sale/purchase context)
  party_id              UUID          REFERENCES parties(id),

  -- Financial Year & Period Lock
  financial_year_id     UUID,         -- FK to financial_years added later
  period_is_locked      BOOLEAN       NOT NULL DEFAULT FALSE,  -- set at entry time from is_period_locked()

  -- Narration
  narration             TEXT,
  remarks               TEXT,

  -- FMS / subsidy
  pos_transaction_ref   TEXT,
  fms_transaction_id    TEXT,
  subsidy_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Reversal linkage
  reversed_by_id        UUID          REFERENCES stock_ledger(id),
  reversal_of_id        UUID          REFERENCES stock_ledger(id),
  is_reversal           BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Audit (no updated_at — INSERT ONLY)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT location_required CHECK (
    from_location_id IS NOT NULL OR to_location_id IS NOT NULL
  ),
  CONSTRAINT transfer_needs_both_locations CHECK (
    movement_type NOT IN ('TRANSFER_IN','TRANSFER_OUT')
    OR (from_location_id IS NOT NULL AND to_location_id IS NOT NULL)
  ),
  CONSTRAINT no_self_transfer CHECK (
    from_location_id IS NULL OR to_location_id IS NULL
    OR from_location_id <> to_location_id
  )
);

-- RLS — stock ledger is readable by anyone in the tenant; write via server actions only
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_ledger_tenant_select" ON stock_ledger
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "stock_ledger_tenant_insert" ON stock_ledger
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
-- NO UPDATE policy — stock_ledger is INSERT-only
-- NO DELETE policy
CREATE POLICY "stock_ledger_no_update" ON stock_ledger
  FOR UPDATE USING (FALSE);
CREATE POLICY "stock_ledger_no_delete" ON stock_ledger
  FOR DELETE USING (FALSE);

-- Indexes (heavy query targets)
CREATE INDEX idx_sl_product_date    ON stock_ledger(product_id, movement_date DESC);
CREATE INDEX idx_sl_batch           ON stock_ledger(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_sl_location_to     ON stock_ledger(to_location_id, movement_date DESC) WHERE to_location_id IS NOT NULL;
CREATE INDEX idx_sl_location_from   ON stock_ledger(from_location_id, movement_date DESC) WHERE from_location_id IS NOT NULL;
CREATE INDEX idx_sl_party           ON stock_ledger(party_id) WHERE party_id IS NOT NULL;
CREATE INDEX idx_sl_source_doc      ON stock_ledger(source_document_type, source_document_id) WHERE source_document_id IS NOT NULL;
CREATE INDEX idx_sl_tenant_date     ON stock_ledger(tenant_id, organisation_id, movement_date DESC);
CREATE INDEX idx_sl_fms             ON stock_ledger(fms_transaction_id) WHERE fms_transaction_id IS NOT NULL;

-- ── Stock Balance View ────────────────────────────────────────
-- Real-time balance per (product, batch, location).
-- Used by inventory ledger page and all quantity validation.
CREATE OR REPLACE VIEW stock_balance AS
SELECT
  tenant_id,
  organisation_id,
  product_id,
  batch_id,
  -- Location is the destination for inbound, source for outbound
  COALESCE(to_location_id, from_location_id)   AS location_id,
  SUM(
    CASE
      -- Inbound movements: add qty
      WHEN movement_type IN ('GRN','OPENING','RETURN_FROM_SALE','TRANSFER_IN','QUARANTINE_RELEASE','ADJ_INCREASE','FMS_RETURN')
        THEN qty
      -- Outbound movements: subtract qty
      WHEN movement_type IN ('SALE','RETURN_TO_SUPPLIER','TRANSFER_OUT','QUARANTINE_HOLD','ADJ_DECREASE','EXPIRY_WRITE_OFF','DAMAGE_WRITE_OFF','FMS_SUBSIDY_OUT')
        THEN -qty
      ELSE 0
    END
  )                                              AS balance_qty,
  MAX(movement_date)                             AS last_movement_date
FROM stock_ledger
WHERE is_reversal = FALSE
GROUP BY tenant_id, organisation_id, product_id, batch_id,
         COALESCE(to_location_id, from_location_id);

-- ── C&F Stock Register ────────────────────────────────────────
-- Tracks stock held at C&F agent locations with confirmation status.
CREATE TABLE cf_stock_register (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id       UUID        NOT NULL REFERENCES organisations(id),

  -- The C&F agent party
  cf_agent_id           UUID        NOT NULL REFERENCES parties(id),
  -- The location at C&F agent premises
  location_id           UUID        NOT NULL REFERENCES locations(id),

  -- Product & batch
  product_id            UUID        NOT NULL REFERENCES products(id),
  batch_id              UUID        REFERENCES batch_register(id),

  -- Quantity held
  qty_held              NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (qty_held >= 0),
  qty_confirmed         NUMERIC(15,3) NOT NULL DEFAULT 0,
  qty_variance          NUMERIC(15,3) GENERATED ALWAYS AS (qty_held - qty_confirmed) STORED,
  unit_of_measure       TEXT        NOT NULL,

  -- Last confirmation
  last_confirmed_date   DATE,
  next_confirmation_due DATE,
  confirmation_ref      TEXT,         -- reference number from C&F agent

  -- Status
  is_reconciled         BOOLEAN     NOT NULL DEFAULT FALSE,
  discrepancy_noted     BOOLEAN     NOT NULL DEFAULT FALSE,
  discrepancy_remarks   TEXT,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID        REFERENCES auth.users(id),
  updated_by            UUID        REFERENCES auth.users(id)
);

ALTER TABLE cf_stock_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf_stock_tenant_select" ON cf_stock_register
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "cf_stock_tenant_insert" ON cf_stock_register
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "cf_stock_tenant_update" ON cf_stock_register
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "cf_stock_no_delete" ON cf_stock_register
  FOR DELETE USING (FALSE);

CREATE INDEX idx_cf_stock_agent    ON cf_stock_register(cf_agent_id, product_id);
CREATE INDEX idx_cf_stock_product  ON cf_stock_register(tenant_id, product_id);

CREATE TRIGGER set_cf_stock_updated_at
  BEFORE UPDATE ON cf_stock_register
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Core Stock Helper Functions ───────────────────────────────

-- Get current balance for a product at a location
CREATE OR REPLACE FUNCTION public.get_stock_balance(
  p_tenant_id    UUID,
  p_product_id   UUID,
  p_location_id  UUID DEFAULT NULL,
  p_batch_id     UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('GRN','OPENING','RETURN_FROM_SALE','TRANSFER_IN','QUARANTINE_RELEASE','ADJ_INCREASE','FMS_RETURN')
        THEN qty
      WHEN movement_type IN ('SALE','RETURN_TO_SUPPLIER','TRANSFER_OUT','QUARANTINE_HOLD','ADJ_DECREASE','EXPIRY_WRITE_OFF','DAMAGE_WRITE_OFF','FMS_SUBSIDY_OUT')
        THEN -qty
      ELSE 0
    END
  ), 0)
  FROM stock_ledger
  WHERE tenant_id   = p_tenant_id
    AND product_id  = p_product_id
    AND is_reversal = FALSE
    AND (p_location_id IS NULL
         OR COALESCE(to_location_id, from_location_id) = p_location_id)
    AND (p_batch_id IS NULL OR batch_id = p_batch_id);
$$;

-- Validate: check stock availability before sale
CREATE OR REPLACE FUNCTION public.check_stock_available(
  p_tenant_id    UUID,
  p_product_id   UUID,
  p_location_id  UUID,
  p_batch_id     UUID,
  p_qty_required NUMERIC
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.get_stock_balance(p_tenant_id, p_product_id, p_location_id, p_batch_id) >= p_qty_required;
$$;

-- Period-lock guard: returns error if movement_date falls in locked period
CREATE OR REPLACE FUNCTION public.assert_period_not_locked(
  p_tenant_id       UUID,
  p_organisation_id UUID,
  p_movement_date   DATE,
  p_lock_type       TEXT DEFAULT 'FINANCIAL'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF public.is_period_locked(p_tenant_id, p_organisation_id, p_movement_date, p_lock_type) THEN
    RAISE EXCEPTION 'Period is locked for date % (lock type: %)', p_movement_date, p_lock_type
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;
