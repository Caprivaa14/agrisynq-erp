-- ============================================================
-- Migration 022: Purchase Invoices (GRN + Tax Invoice)
-- FertiLedger ERP — Phase 4 Purchases Engine
-- ============================================================
-- A Purchase Invoice records:
--   1. Receipt of goods from supplier (GRN — Goods Receipt Note)
--   2. Tax invoice details (supplier's invoice number + GST)
--
-- When a Purchase Invoice is POSTED it automatically:
--   - Creates batch_register entries for received goods
--   - Posts GRN stock_ledger entries
--   - Creates the accounts payable voucher (deferred to Phase 6)
--
-- CARDINAL RULES:
--   - Posted invoices CANNOT be deleted or backdated
--   - Corrections via Purchase Return (Debit Note) only
--   - GST values are ALWAYS recomputed server-side
-- ============================================================

-- ── ENUMs ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE purchase_invoice_status AS ENUM (
    'DRAFT',      -- being entered
    'POSTED',     -- finalised, stock updated, payable created
    'CANCELLED'   -- cancelled before posting (rare, audit-logged)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE supplier_type_enum AS ENUM (
    'REGISTERED',       -- regular GST registered supplier
    'COMPOSITION',      -- composition dealer
    'UNREGISTERED',     -- URD purchase
    'IMPORT',           -- import (IGST applicable)
    'SEZ'               -- SEZ supply
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Purchase Invoices ──────────────────────────────────────────
CREATE TABLE purchase_invoices (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID          NOT NULL REFERENCES organisations(id),
  branch_id               UUID          REFERENCES branches(id),

  -- Document identity
  invoice_number          TEXT          NOT NULL,         -- internal number (auto-series)
  invoice_date            DATE          NOT NULL DEFAULT CURRENT_DATE,

  -- Supplier's document
  supplier_invoice_no     TEXT,                          -- supplier's invoice number
  supplier_invoice_date   DATE,

  -- Reference to PO (optional — can be direct purchase)
  po_id                   UUID          REFERENCES purchase_orders(id),

  -- Supplier
  supplier_id             UUID          NOT NULL REFERENCES parties(id),
  supplier_type           supplier_type_enum NOT NULL DEFAULT 'REGISTERED',
  supplier_gstin          TEXT,                          -- supplier GSTIN at time of purchase

  -- Receipt location
  received_at_location    UUID          NOT NULL REFERENCES locations(id),

  -- GST applicability
  place_of_supply         CHAR(2),                       -- state code
  is_interstate           BOOLEAN       NOT NULL DEFAULT FALSE,  -- IGST vs CGST+SGST
  is_reverse_charge       BOOLEAN       NOT NULL DEFAULT FALSE,  -- RCM applicable
  is_import               BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Financial summary
  gross_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_discount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  cess_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gst_amount        NUMERIC(15,2) GENERATED ALWAYS AS (
                            cgst_amount + sgst_amount + igst_amount + cess_amount
                          ) STORED,
  other_charges           NUMERIC(15,2) NOT NULL DEFAULT 0,  -- freight, handling
  round_off               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  net_payable             NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Payment
  payment_terms_days      SMALLINT      DEFAULT 0,
  due_date                DATE,
  amount_paid             NUMERIC(15,2) NOT NULL DEFAULT 0,
  outstanding_amount      NUMERIC(15,2) GENERATED ALWAYS AS (
                            net_payable - amount_paid
                          ) STORED,

  -- Status
  status                  purchase_invoice_status NOT NULL DEFAULT 'DRAFT',
  posted_at               TIMESTAMPTZ,
  posted_by               UUID          REFERENCES auth.users(id),

  -- Narration & notes
  narration               TEXT,
  internal_notes          TEXT,

  -- Audit
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          REFERENCES auth.users(id),
  updated_by              UUID          REFERENCES auth.users(id),

  CONSTRAINT pi_number_unique UNIQUE (tenant_id, organisation_id, invoice_number),
  CONSTRAINT pi_posting_date_immutable CHECK (
    status = 'DRAFT' OR posted_at IS NOT NULL
  )
);

-- ── Purchase Invoice Lines (GRN lines) ─────────────────────────
CREATE TABLE purchase_invoice_lines (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              UUID          NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  tenant_id               UUID          NOT NULL REFERENCES tenants(id),
  line_no                 SMALLINT      NOT NULL,

  -- PO line reference (optional)
  po_line_id              UUID          REFERENCES purchase_order_lines(id),

  -- Product
  product_id              UUID          NOT NULL REFERENCES products(id),
  description             TEXT,
  hsn_code                TEXT          NOT NULL,

  -- Batch info (collected at GRN time)
  batch_number            TEXT,                           -- supplier batch
  manufacture_date        DATE,
  expiry_date             DATE,

  -- Quantity
  received_qty            NUMERIC(15,3) NOT NULL CHECK (received_qty > 0),
  unit_of_measure         TEXT          NOT NULL,
  free_qty                NUMERIC(15,3) NOT NULL DEFAULT 0,  -- bonus/free goods

  -- Pricing
  unit_price              NUMERIC(15,4) NOT NULL CHECK (unit_price >= 0),
  discount_percent        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- set server-side

  -- GST (server-side computed from tax_profiles)
  gst_rate                NUMERIC(5,2)  NOT NULL DEFAULT 0,
  cgst_rate               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  sgst_rate               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  igst_rate               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  cgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  cess_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total              NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Landing cost (after freight allocation)
  landing_cost_per_unit   NUMERIC(15,4) NOT NULL DEFAULT 0,

  -- Batch register linkage (set after posting)
  batch_id                UUID          REFERENCES batch_register(id),

  CONSTRAINT pil_line_unique UNIQUE (invoice_id, line_no)
);

-- ── Purchase Returns (Debit Notes) ─────────────────────────────
CREATE TABLE purchase_returns (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID          NOT NULL REFERENCES organisations(id),
  branch_id               UUID          REFERENCES branches(id),

  -- Document
  return_number           TEXT          NOT NULL,
  return_date             DATE          NOT NULL DEFAULT CURRENT_DATE,
  debit_note_number       TEXT,                          -- supplier's acknowledgement ref

  -- Original invoice
  original_invoice_id     UUID          NOT NULL REFERENCES purchase_invoices(id),
  supplier_id             UUID          NOT NULL REFERENCES parties(id),
  return_from_location    UUID          REFERENCES locations(id),

  -- Return reason
  return_reason           TEXT          NOT NULL,
  return_type             TEXT          NOT NULL DEFAULT 'QUALITY',  -- QUALITY / EXCESS / WRONG_GOODS / DAMAGED

  -- Financial
  taxable_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Status
  status                  TEXT          NOT NULL DEFAULT 'DRAFT',  -- DRAFT / POSTED
  posted_at               TIMESTAMPTZ,

  -- Audit
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          REFERENCES auth.users(id),

  CONSTRAINT pr_number_unique UNIQUE (tenant_id, organisation_id, return_number)
);

CREATE TABLE purchase_return_lines (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id               UUID          NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  tenant_id               UUID          NOT NULL REFERENCES tenants(id),
  invoice_line_id         UUID          REFERENCES purchase_invoice_lines(id),
  product_id              UUID          NOT NULL REFERENCES products(id),
  batch_id                UUID          REFERENCES batch_register(id),
  return_qty              NUMERIC(15,3) NOT NULL CHECK (return_qty > 0),
  unit_of_measure         TEXT          NOT NULL,
  unit_price              NUMERIC(15,4) NOT NULL DEFAULT 0,
  taxable_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_rate                NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total              NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE purchase_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_returns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_lines   ENABLE ROW LEVEL SECURITY;

-- purchase_invoices
CREATE POLICY "pi_tenant_select"  ON purchase_invoices      FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pi_tenant_insert"  ON purchase_invoices      FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pi_draft_update"   ON purchase_invoices      FOR UPDATE USING (tenant_id = public.get_tenant_id() AND status = 'DRAFT');
CREATE POLICY "pi_no_delete"      ON purchase_invoices      FOR DELETE USING (FALSE);

-- purchase_invoice_lines
CREATE POLICY "pil_tenant_select" ON purchase_invoice_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pil_tenant_insert" ON purchase_invoice_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pil_tenant_update" ON purchase_invoice_lines FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pil_no_delete"     ON purchase_invoice_lines FOR DELETE USING (FALSE);

-- purchase_returns
CREATE POLICY "pr_tenant_select"  ON purchase_returns       FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pr_tenant_insert"  ON purchase_returns       FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pr_draft_update"   ON purchase_returns       FOR UPDATE USING (tenant_id = public.get_tenant_id() AND status = 'DRAFT');
CREATE POLICY "pr_no_delete"      ON purchase_returns       FOR DELETE USING (FALSE);

CREATE POLICY "prl_tenant_select" ON purchase_return_lines  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "prl_tenant_insert" ON purchase_return_lines  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "prl_no_delete"     ON purchase_return_lines  FOR DELETE USING (FALSE);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_pi_supplier     ON purchase_invoices(supplier_id, invoice_date DESC);
CREATE INDEX idx_pi_status       ON purchase_invoices(tenant_id, status);
CREATE INDEX idx_pi_date         ON purchase_invoices(tenant_id, organisation_id, invoice_date DESC);
CREATE INDEX idx_pi_po           ON purchase_invoices(po_id) WHERE po_id IS NOT NULL;
CREATE INDEX idx_pi_outstanding  ON purchase_invoices(tenant_id, outstanding_amount) WHERE outstanding_amount > 0;
CREATE INDEX idx_pil_product     ON purchase_invoice_lines(product_id);
CREATE INDEX idx_pil_batch       ON purchase_invoice_lines(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_pr_supplier     ON purchase_returns(supplier_id, return_date DESC);
CREATE INDEX idx_pr_invoice      ON purchase_returns(original_invoice_id);

-- Triggers
CREATE TRIGGER set_pi_updated_at
  BEFORE UPDATE ON purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_pr_updated_at
  BEFORE UPDATE ON purchase_returns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Invoice Number Auto-generation ───────────────────────────
-- Format: PI-{YYYY}-{NNNNN}
CREATE OR REPLACE FUNCTION public.generate_pi_number(
  p_tenant_id       UUID,
  p_organisation_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_year  TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
    FROM purchase_invoices
   WHERE tenant_id       = p_tenant_id
     AND organisation_id = p_organisation_id
     AND invoice_number LIKE 'PI-' || v_year || '-%';
  RETURN 'PI-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
END; $$;

-- Purchase Return number auto-generation
CREATE OR REPLACE FUNCTION public.generate_pr_number(
  p_tenant_id       UUID,
  p_organisation_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_year  TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
    FROM purchase_returns
   WHERE tenant_id       = p_tenant_id
     AND organisation_id = p_organisation_id
     AND return_number LIKE 'PR-' || v_year || '-%';
  RETURN 'PR-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
END; $$;

-- ── Supplier Payable View ─────────────────────────────────────
-- Current outstanding payables per supplier
CREATE OR REPLACE VIEW supplier_payables AS
SELECT
  pi.tenant_id,
  pi.organisation_id,
  pi.supplier_id,
  p.name                  AS supplier_name,
  COUNT(pi.id)            AS invoice_count,
  SUM(pi.net_payable)     AS total_invoiced,
  SUM(pi.amount_paid)     AS total_paid,
  SUM(pi.outstanding_amount) AS total_outstanding,
  MAX(pi.due_date)        AS latest_due_date,
  MIN(CASE WHEN pi.outstanding_amount > 0 THEN pi.due_date END) AS earliest_overdue_date
FROM purchase_invoices pi
JOIN parties p ON p.id = pi.supplier_id
WHERE pi.status = 'POSTED'
  AND pi.is_active = TRUE
GROUP BY pi.tenant_id, pi.organisation_id, pi.supplier_id, p.name;
