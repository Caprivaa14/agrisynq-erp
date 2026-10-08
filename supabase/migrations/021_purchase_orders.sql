-- ============================================================
-- Migration 021: Purchase Orders
-- FertiLedger ERP — Phase 4 Purchases Engine
-- ============================================================
-- A Purchase Order (PO) is a formal commitment to a supplier
-- to buy specific products at agreed terms.
-- PO → GRN (partial or full receipts) → Purchase Invoice
-- ============================================================

-- ── ENUMs ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE po_status_enum AS ENUM (
    'DRAFT',        -- being prepared, not sent
    'SENT',         -- sent to supplier
    'ACKNOWLEDGED', -- supplier confirmed receipt
    'PARTIALLY_RECEIVED', -- at least one GRN posted
    'FULLY_RECEIVED',     -- all line items GRN'd
    'CLOSED',       -- manually closed (no more receipts)
    'CANCELLED'     -- cancelled before any receipt
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Purchase Orders ────────────────────────────────────────────
CREATE TABLE purchase_orders (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id       UUID          NOT NULL REFERENCES organisations(id),
  branch_id             UUID          REFERENCES branches(id),

  -- Document identity
  po_number             TEXT          NOT NULL,           -- auto-generated series
  po_date               DATE          NOT NULL DEFAULT CURRENT_DATE,
  reference_no          TEXT,                            -- supplier/internal ref

  -- Supplier
  supplier_id           UUID          NOT NULL REFERENCES parties(id),

  -- Delivery
  deliver_to_location   UUID          REFERENCES locations(id),
  expected_delivery_date DATE,

  -- Financial summary (computed from lines)
  total_taxable_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gst_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency              CHAR(3)       NOT NULL DEFAULT 'INR',

  -- Terms
  payment_terms_days    SMALLINT      DEFAULT 0,
  discount_percent      NUMERIC(5,2)  DEFAULT 0,
  narration             TEXT,
  terms_and_conditions  TEXT,

  -- Status
  status                po_status_enum NOT NULL DEFAULT 'DRAFT',

  -- Audit
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id),
  updated_by            UUID          REFERENCES auth.users(id),

  CONSTRAINT po_number_unique UNIQUE (tenant_id, organisation_id, po_number)
);

-- ── Purchase Order Lines ───────────────────────────────────────
CREATE TABLE purchase_order_lines (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                 UUID          NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  tenant_id             UUID          NOT NULL REFERENCES tenants(id),
  line_no               SMALLINT      NOT NULL,

  product_id            UUID          NOT NULL REFERENCES products(id),
  description           TEXT,

  -- Quantity
  ordered_qty           NUMERIC(15,3) NOT NULL CHECK (ordered_qty > 0),
  received_qty          NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  pending_qty           NUMERIC(15,3) GENERATED ALWAYS AS (ordered_qty - received_qty) STORED,
  unit_of_measure       TEXT          NOT NULL,

  -- Pricing
  unit_price            NUMERIC(15,4) NOT NULL CHECK (unit_price >= 0),
  discount_percent      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  taxable_amount        NUMERIC(15,2) GENERATED ALWAYS AS (
                          ROUND(ordered_qty * unit_price * (1 - discount_percent/100), 2)
                        ) STORED,
  gst_rate              NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,  -- recalculated at invoice time
  total_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Line status
  is_closed             BOOLEAN       NOT NULL DEFAULT FALSE,

  CONSTRAINT po_line_no_unique UNIQUE (po_id, line_no),
  CONSTRAINT received_not_exceed_ordered CHECK (received_qty <= ordered_qty)
);

-- RLS
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_tenant_select" ON purchase_orders       FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "po_tenant_insert" ON purchase_orders       FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "po_tenant_update" ON purchase_orders       FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "po_no_delete"     ON purchase_orders       FOR DELETE USING (FALSE);

CREATE POLICY "pol_tenant_select" ON purchase_order_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pol_tenant_insert" ON purchase_order_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pol_tenant_update" ON purchase_order_lines FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pol_no_delete"     ON purchase_order_lines FOR DELETE USING (FALSE);

-- Indexes
CREATE INDEX idx_po_supplier   ON purchase_orders(supplier_id, po_date DESC);
CREATE INDEX idx_po_status     ON purchase_orders(tenant_id, status);
CREATE INDEX idx_po_date       ON purchase_orders(tenant_id, organisation_id, po_date DESC);
CREATE INDEX idx_pol_product   ON purchase_order_lines(product_id);

-- updated_at triggers
CREATE TRIGGER set_po_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── PO Number Auto-generation ─────────────────────────────────
-- Format: PO-{YYYY}-{NNNNN}  e.g. PO-2026-00001
CREATE OR REPLACE FUNCTION public.generate_po_number(
  p_tenant_id       UUID,
  p_organisation_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_year    TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_count   INTEGER;
  v_prefix  TEXT;
BEGIN
  v_prefix := 'PO-' || v_year || '-';
  SELECT COUNT(*) + 1
    INTO v_count
    FROM purchase_orders
   WHERE tenant_id       = p_tenant_id
     AND organisation_id = p_organisation_id
     AND po_number LIKE v_prefix || '%';
  RETURN v_prefix || LPAD(v_count::TEXT, 5, '0');
END; $$;
