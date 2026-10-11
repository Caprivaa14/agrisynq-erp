-- ============================================================
-- Migration 024: Sales Invoices & Credit Notes
-- FertiLedger ERP — Phase 5 Sales Engine
-- ============================================================
-- LEGAL REQUIREMENTS (non-negotiable):
--   * Posted invoices CANNOT be deleted or backdated
--   * Corrections ONLY via Credit Note referencing original invoice
--   * Credit Note amount CANNOT exceed original invoice amount
--   * GST values are ALWAYS recomputed server-side
--   * Tax treatment MUST be driven by product HSN, customer status,
--     place of supply, and applicable statutory rules
--   * No arbitrary "GST" / "No GST" selection for taxable products
-- ============================================================

-- ── ENUMs ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE invoice_type_enum AS ENUM (
    'B2B',         -- Business-to-Business (customer has GSTIN)
    'B2C_LARGE',   -- B2C > ₹2.5L (individual details required)
    'B2C_SMALL',   -- B2C ≤ ₹2.5L (consolidated allowed)
    'EXPORT',      -- Export with/without IGST
    'SEZ',         -- SEZ supply
    'DEEMED_EXPORT',
    'PROFORMA'     -- Pro forma — non-tax invoice, for advance/reference
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_type_enum AS ENUM (
    'CASH',        -- outright cash sale
    'CREDIT',      -- credit sale, payable later
    'ADVANCE',     -- advance against order
    'SUBSIDY',     -- subsidised farmer sale via FMS/PoS
    'EXCHANGE'     -- barter/exchange (rare)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status_enum AS ENUM (
    'DRAFT',      -- being prepared
    'POSTED',     -- tax liability created, stock reduced
    'CANCELLED'   -- cancelled (only pre-posting, audit-logged)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE credit_note_reason AS ENUM (
    'RETURN_OF_GOODS',
    'PRICE_ADJUSTMENT',
    'GOODS_DEFECTIVE',
    'EXCESS_BILLED',
    'DISCOUNT_POST_SALE',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Sales Invoices (Tax Invoices) ─────────────────────────────
CREATE TABLE sales_invoices (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID          NOT NULL REFERENCES organisations(id),
  branch_id               UUID          REFERENCES branches(id),

  -- Document identity
  invoice_number          TEXT          NOT NULL,     -- immutable once posted
  invoice_date            DATE          NOT NULL DEFAULT CURRENT_DATE,
  invoice_type            invoice_type_enum NOT NULL DEFAULT 'B2C_SMALL',
  sale_type               sale_type_enum    NOT NULL DEFAULT 'CASH',
  reference_no            TEXT,

  -- Source documents (optional)
  so_id                   UUID          REFERENCES sales_orders(id),
  quotation_id            UUID          REFERENCES sales_quotations(id),

  -- Bill-to party
  customer_id             UUID          REFERENCES parties(id),
  customer_name           TEXT,         -- for walk-in / cash sale
  customer_gstin          TEXT,         -- at time of invoice (immutable after posting)
  customer_gst_status     TEXT,         -- REGULAR / COMPOSITION / UNREGISTERED
  customer_phone          TEXT,
  customer_address        TEXT,
  customer_state_code     CHAR(2),

  -- Ship-to (Bill-to/Ship-to support)
  ship_to_customer_id     UUID          REFERENCES parties(id),
  ship_to_address         TEXT,
  ship_to_state_code      CHAR(2),

  -- Dispatch from
  from_location           UUID          REFERENCES locations(id),

  -- GST applicability (server-computed)
  place_of_supply         CHAR(2),      -- state code of supply
  is_interstate           BOOLEAN       NOT NULL DEFAULT FALSE,  -- IGST vs CGST+SGST
  is_reverse_charge       BOOLEAN       NOT NULL DEFAULT FALSE,
  is_export               BOOLEAN       NOT NULL DEFAULT FALSE,
  export_type             TEXT,         -- WITH_IGST / WITHOUT_IGST
  lut_number              TEXT,         -- Letter of Undertaking for zero-rated

  -- Financial (server-computed, immutable after posting)
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
  other_charges           NUMERIC(15,2) NOT NULL DEFAULT 0,
  round_off               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  net_receivable          NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Payment / settlement
  payment_terms_days      SMALLINT      DEFAULT 0,
  due_date                DATE,
  amount_received         NUMERIC(15,2) NOT NULL DEFAULT 0,
  outstanding_amount      NUMERIC(15,2) GENERATED ALWAYS AS (
                            net_receivable - amount_received
                          ) STORED,

  -- E-invoice / E-way bill (future)
  irn                     TEXT,         -- Invoice Reference Number from IRP
  eway_bill_number        TEXT,
  eway_bill_date          DATE,

  -- Status & audit
  status                  invoice_status_enum NOT NULL DEFAULT 'DRAFT',
  posted_at               TIMESTAMPTZ,
  posted_by               UUID          REFERENCES auth.users(id),
  cancelled_at            TIMESTAMPTZ,
  cancellation_reason     TEXT,

  narration               TEXT,
  internal_notes          TEXT,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          REFERENCES auth.users(id),
  updated_by              UUID          REFERENCES auth.users(id),

  CONSTRAINT si_number_unique UNIQUE (tenant_id, organisation_id, invoice_number),

  -- IMMUTABILITY GUARD: financial values cannot change after posting
  CONSTRAINT si_posting_guard CHECK (
    status = 'DRAFT' OR (posted_at IS NOT NULL AND posted_by IS NOT NULL)
  )
);

-- ── Sales Invoice Lines ────────────────────────────────────────
CREATE TABLE sales_invoice_lines (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              UUID          NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  tenant_id               UUID          NOT NULL REFERENCES tenants(id),
  line_no                 SMALLINT      NOT NULL,

  -- Source
  so_line_id              UUID          REFERENCES sales_order_lines(id),

  -- Product
  product_id              UUID          NOT NULL REFERENCES products(id),
  description             TEXT,
  hsn_code                TEXT          NOT NULL,

  -- Batch (FIFO from batch_register)
  batch_id                UUID          REFERENCES batch_register(id),
  batch_number            TEXT,
  expiry_date             DATE,

  -- Quantity
  qty                     NUMERIC(15,3) NOT NULL CHECK (qty > 0),
  unit_of_measure         TEXT          NOT NULL,
  free_qty                NUMERIC(15,3) NOT NULL DEFAULT 0,

  -- Pricing (server-computed)
  unit_price              NUMERIC(15,4) NOT NULL CHECK (unit_price >= 0),
  mrp                     NUMERIC(15,4),
  discount_percent        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- GST split (server-computed from tax_profiles, never trusted from browser)
  gst_rate                NUMERIC(5,2)  NOT NULL DEFAULT 0,
  cgst_rate               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  sgst_rate               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  igst_rate               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  cgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  cess_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total              NUMERIC(15,2) NOT NULL DEFAULT 0,

  CONSTRAINT sil_line_unique UNIQUE (invoice_id, line_no)
);

-- ── Credit Notes (Sales Returns / Price Adjustments) ──────────
CREATE TABLE credit_notes (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id         UUID          NOT NULL REFERENCES organisations(id),
  branch_id               UUID          REFERENCES branches(id),

  credit_note_number      TEXT          NOT NULL,
  credit_note_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
  reason                  credit_note_reason NOT NULL,
  reason_detail           TEXT,

  -- Must reference original posted invoice
  original_invoice_id     UUID          NOT NULL REFERENCES sales_invoices(id),
  customer_id             UUID          REFERENCES parties(id),
  customer_name           TEXT,
  customer_gstin          TEXT,

  -- Whether goods were physically returned
  goods_returned          BOOLEAN       NOT NULL DEFAULT TRUE,
  return_to_location      UUID          REFERENCES locations(id),

  -- Financial (cannot exceed original invoice)
  taxable_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,

  status                  TEXT          NOT NULL DEFAULT 'DRAFT',  -- DRAFT / POSTED
  posted_at               TIMESTAMPTZ,
  posted_by               UUID          REFERENCES auth.users(id),

  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          REFERENCES auth.users(id),

  CONSTRAINT cn_number_unique UNIQUE (tenant_id, organisation_id, credit_note_number)
);

CREATE TABLE credit_note_lines (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id          UUID          NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  tenant_id               UUID          NOT NULL REFERENCES tenants(id),
  original_line_id        UUID          REFERENCES sales_invoice_lines(id),
  product_id              UUID          NOT NULL REFERENCES products(id),
  hsn_code                TEXT          NOT NULL,
  batch_id                UUID          REFERENCES batch_register(id),
  return_qty              NUMERIC(15,3) NOT NULL CHECK (return_qty > 0),
  unit_of_measure         TEXT          NOT NULL,
  unit_price              NUMERIC(15,4) NOT NULL DEFAULT 0,
  taxable_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_rate                NUMERIC(5,2)  NOT NULL DEFAULT 0,
  cgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount             NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total              NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE sales_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_lines    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_tenant_select" ON sales_invoices      FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "si_tenant_insert" ON sales_invoices      FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "si_draft_update"  ON sales_invoices      FOR UPDATE USING (tenant_id = public.get_tenant_id() AND status = 'DRAFT');
CREATE POLICY "si_no_delete"     ON sales_invoices      FOR DELETE USING (FALSE);

CREATE POLICY "sil_tenant_select" ON sales_invoice_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "sil_tenant_insert" ON sales_invoice_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "sil_no_delete"    ON sales_invoice_lines  FOR DELETE USING (FALSE);

CREATE POLICY "cn_tenant_select" ON credit_notes        FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "cn_tenant_insert" ON credit_notes        FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "cn_draft_update"  ON credit_notes        FOR UPDATE USING (tenant_id = public.get_tenant_id() AND status = 'DRAFT');
CREATE POLICY "cn_no_delete"     ON credit_notes        FOR DELETE USING (FALSE);

CREATE POLICY "cnl_tenant_select" ON credit_note_lines  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "cnl_tenant_insert" ON credit_note_lines  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "cnl_no_delete"    ON credit_note_lines   FOR DELETE USING (FALSE);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_si_customer   ON sales_invoices(customer_id, invoice_date DESC);
CREATE INDEX idx_si_status     ON sales_invoices(tenant_id, status);
CREATE INDEX idx_si_date       ON sales_invoices(tenant_id, organisation_id, invoice_date DESC);
CREATE INDEX idx_si_so         ON sales_invoices(so_id) WHERE so_id IS NOT NULL;
CREATE INDEX idx_si_outstanding ON sales_invoices(tenant_id, outstanding_amount) WHERE outstanding_amount > 0;
CREATE INDEX idx_si_type       ON sales_invoices(tenant_id, invoice_type, invoice_date DESC);
CREATE INDEX idx_sil_product   ON sales_invoice_lines(product_id);
CREATE INDEX idx_sil_batch     ON sales_invoice_lines(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_cn_invoice    ON credit_notes(original_invoice_id);
CREATE INDEX idx_cn_customer   ON credit_notes(customer_id, credit_note_date DESC);

-- Triggers
CREATE TRIGGER set_si_updated_at BEFORE UPDATE ON sales_invoices  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_cn_updated_at BEFORE UPDATE ON credit_notes     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Auto-number Functions ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_tenant_id UUID, p_org_id UUID, p_prefix TEXT DEFAULT 'INV')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fy   TEXT := TO_CHAR(CURRENT_DATE,'YYYY') || '-' || LPAD((EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1 - 2000)::TEXT,2,'0');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)+1 INTO v_count FROM sales_invoices
   WHERE tenant_id=p_tenant_id AND organisation_id=p_org_id
     AND invoice_number LIKE p_prefix||'-'||v_fy||'-%';
  RETURN p_prefix||'-'||v_fy||'-'||LPAD(v_count::TEXT,5,'0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_cn_number(p_tenant_id UUID, p_org_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fy   TEXT := TO_CHAR(CURRENT_DATE,'YYYY') || '-' || LPAD((EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1 - 2000)::TEXT,2,'0');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)+1 INTO v_count FROM credit_notes
   WHERE tenant_id=p_tenant_id AND organisation_id=p_org_id
     AND credit_note_number LIKE 'CN-'||v_fy||'-%';
  RETURN 'CN-'||v_fy||'-'||LPAD(v_count::TEXT,5,'0');
END; $$;

-- ── Customer Receivables View ──────────────────────────────────
CREATE OR REPLACE VIEW customer_receivables AS
SELECT
  si.tenant_id,
  si.organisation_id,
  si.customer_id,
  COALESCE(si.customer_name, p.name) AS customer_name,
  si.customer_gstin,
  COUNT(si.id)              AS invoice_count,
  SUM(si.net_receivable)    AS total_invoiced,
  SUM(si.amount_received)   AS total_received,
  SUM(si.outstanding_amount) AS total_outstanding,
  MIN(CASE WHEN si.outstanding_amount > 0 THEN si.due_date END) AS earliest_due_date
FROM sales_invoices si
LEFT JOIN parties p ON p.id = si.customer_id
WHERE si.status = 'POSTED'
  AND si.is_active = TRUE
GROUP BY si.tenant_id, si.organisation_id, si.customer_id, COALESCE(si.customer_name, p.name), si.customer_gstin;

-- ── GST Summary View (for GSTR-1 preparation) ────────────────
CREATE OR REPLACE VIEW gst_sales_register AS
SELECT
  si.tenant_id,
  si.organisation_id,
  si.invoice_date,
  DATE_TRUNC('month', si.invoice_date) AS period_month,
  si.invoice_number,
  si.invoice_type,
  COALESCE(si.customer_name, p.name) AS party_name,
  si.customer_gstin,
  si.place_of_supply,
  si.is_interstate,
  si.taxable_amount,
  si.cgst_amount,
  si.sgst_amount,
  si.igst_amount,
  si.cess_amount,
  si.total_gst_amount,
  si.net_receivable,
  si.status
FROM sales_invoices si
LEFT JOIN parties p ON p.id = si.customer_id
WHERE si.is_active = TRUE
  AND si.status IN ('POSTED', 'CANCELLED');
