-- ============================================================
-- Migration 023: Sales Quotations & Sales Orders
-- FertiLedger ERP — Phase 5 Sales Engine
-- ============================================================
-- Quotation → Sales Order → Tax Invoice workflow
-- Orders track stock reservation and pending delivery
-- ============================================================

-- ── ENUMs ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE quotation_status AS ENUM (
    'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sales_order_status AS ENUM (
    'DRAFT',              -- being prepared
    'CONFIRMED',          -- confirmed, stock to be reserved
    'PARTIALLY_INVOICED', -- some lines invoiced
    'FULLY_INVOICED',     -- all lines invoiced
    'PARTIALLY_DELIVERED',
    'FULLY_DELIVERED',
    'CLOSED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Sales Quotations ───────────────────────────────────────────
CREATE TABLE sales_quotations (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id       UUID          NOT NULL REFERENCES organisations(id),
  branch_id             UUID          REFERENCES branches(id),

  quotation_number      TEXT          NOT NULL,
  quotation_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  valid_until           DATE,
  reference_no          TEXT,

  -- Customer
  customer_id           UUID          REFERENCES parties(id),
  customer_name         TEXT,         -- for walk-in / unregistered
  customer_gstin        TEXT,
  customer_phone        TEXT,

  -- Delivery
  deliver_to_location   UUID          REFERENCES locations(id),
  delivery_address      TEXT,

  -- Financial
  total_taxable_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gst_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,

  status                quotation_status NOT NULL DEFAULT 'DRAFT',
  narration             TEXT,
  terms_and_conditions  TEXT,

  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id),

  CONSTRAINT quot_number_unique UNIQUE (tenant_id, organisation_id, quotation_number)
);

CREATE TABLE sales_quotation_lines (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id          UUID          NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
  tenant_id             UUID          NOT NULL REFERENCES tenants(id),
  line_no               SMALLINT      NOT NULL,
  product_id            UUID          NOT NULL REFERENCES products(id),
  description           TEXT,
  qty                   NUMERIC(15,3) NOT NULL CHECK (qty > 0),
  unit_of_measure       TEXT          NOT NULL,
  unit_price            NUMERIC(15,4) NOT NULL CHECK (unit_price >= 0),
  discount_percent      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  taxable_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_rate              NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total            NUMERIC(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT quot_line_unique UNIQUE (quotation_id, line_no)
);

-- ── Sales Orders ───────────────────────────────────────────────
CREATE TABLE sales_orders (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id       UUID          NOT NULL REFERENCES organisations(id),
  branch_id             UUID          REFERENCES branches(id),

  order_number          TEXT          NOT NULL,
  order_date            DATE          NOT NULL DEFAULT CURRENT_DATE,
  delivery_date         DATE,
  reference_no          TEXT,

  -- Source quotation (optional)
  quotation_id          UUID          REFERENCES sales_quotations(id),

  -- Customer
  customer_id           UUID          REFERENCES parties(id),
  customer_name         TEXT,
  customer_gstin        TEXT,
  customer_phone        TEXT,

  -- Ship-to (bill-to/ship-to supported)
  ship_to_customer_id   UUID          REFERENCES parties(id),
  ship_to_address       TEXT,
  from_location         UUID          REFERENCES locations(id), -- source warehouse

  -- Financial
  total_taxable_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gst_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  advance_received      NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Terms
  payment_terms_days    SMALLINT      DEFAULT 0,
  is_credit_sale        BOOLEAN       NOT NULL DEFAULT FALSE,

  status                sales_order_status NOT NULL DEFAULT 'DRAFT',
  narration             TEXT,

  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id),
  updated_by            UUID          REFERENCES auth.users(id),

  CONSTRAINT so_number_unique UNIQUE (tenant_id, organisation_id, order_number)
);

CREATE TABLE sales_order_lines (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id                 UUID          NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  tenant_id             UUID          NOT NULL REFERENCES tenants(id),
  line_no               SMALLINT      NOT NULL,
  quotation_line_id     UUID          REFERENCES sales_quotation_lines(id),
  product_id            UUID          NOT NULL REFERENCES products(id),
  description           TEXT,

  ordered_qty           NUMERIC(15,3) NOT NULL CHECK (ordered_qty > 0),
  invoiced_qty          NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (invoiced_qty >= 0),
  delivered_qty         NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (delivered_qty >= 0),
  cancelled_qty         NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (cancelled_qty >= 0),
  pending_qty           NUMERIC(15,3) GENERATED ALWAYS AS (
                          ordered_qty - invoiced_qty - cancelled_qty
                        ) STORED,
  unit_of_measure       TEXT          NOT NULL,

  unit_price            NUMERIC(15,4) NOT NULL CHECK (unit_price >= 0),
  discount_percent      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  taxable_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_rate              NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total            NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Stock reservation
  reserved_batch_id     UUID          REFERENCES batch_register(id),
  is_closed             BOOLEAN       NOT NULL DEFAULT FALSE,

  CONSTRAINT so_line_unique UNIQUE (so_id, line_no),
  CONSTRAINT so_invoiced_not_exceed CHECK (invoiced_qty <= ordered_qty),
  CONSTRAINT so_delivered_not_exceed CHECK (delivered_qty <= ordered_qty)
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE sales_quotations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sq_tenant_select" ON sales_quotations      FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sq_tenant_insert" ON sales_quotations      FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "sq_tenant_update" ON sales_quotations      FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sq_no_delete"     ON sales_quotations      FOR DELETE USING (FALSE);

CREATE POLICY "sql_tenant_select" ON sales_quotation_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sql_tenant_insert" ON sales_quotation_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "sql_no_delete"     ON sales_quotation_lines FOR DELETE USING (FALSE);

CREATE POLICY "so_tenant_select" ON sales_orders          FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "so_tenant_insert" ON sales_orders          FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "so_tenant_update" ON sales_orders          FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "so_no_delete"     ON sales_orders          FOR DELETE USING (FALSE);

CREATE POLICY "sol_tenant_select" ON sales_order_lines    FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sol_tenant_insert" ON sales_order_lines    FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "sol_tenant_update" ON sales_order_lines    FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sol_no_delete"     ON sales_order_lines    FOR DELETE USING (FALSE);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_sq_customer  ON sales_quotations(customer_id, quotation_date DESC);
CREATE INDEX idx_sq_status    ON sales_quotations(tenant_id, status);
CREATE INDEX idx_so_customer  ON sales_orders(customer_id, order_date DESC);
CREATE INDEX idx_so_status    ON sales_orders(tenant_id, status);
CREATE INDEX idx_sol_product  ON sales_order_lines(product_id);

-- ── Auto-number functions ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_sq_number(p_tenant_id UUID, p_org_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year TEXT := TO_CHAR(CURRENT_DATE,'YYYY'); v_count INTEGER;
BEGIN
  SELECT COUNT(*)+1 INTO v_count FROM sales_quotations
   WHERE tenant_id=p_tenant_id AND organisation_id=p_org_id AND quotation_number LIKE 'SQ-'||v_year||'-%';
  RETURN 'SQ-'||v_year||'-'||LPAD(v_count::TEXT,5,'0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_so_number(p_tenant_id UUID, p_org_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year TEXT := TO_CHAR(CURRENT_DATE,'YYYY'); v_count INTEGER;
BEGIN
  SELECT COUNT(*)+1 INTO v_count FROM sales_orders
   WHERE tenant_id=p_tenant_id AND organisation_id=p_org_id AND order_number LIKE 'SO-'||v_year||'-%';
  RETURN 'SO-'||v_year||'-'||LPAD(v_count::TEXT,5,'0');
END; $$;

-- updated_at triggers
CREATE TRIGGER set_sq_updated_at BEFORE UPDATE ON sales_quotations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_so_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
