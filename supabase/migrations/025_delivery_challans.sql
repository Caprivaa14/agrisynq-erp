-- ============================================================
-- Migration 025: Delivery Challans
-- FertiLedger ERP — Phase 5 Sales Engine
-- ============================================================
-- Delivery Challan (DC) is a non-tax document for permitted
-- goods movements that are NOT a sale:
--   - Stock transfer between own branches/warehouses
--   - Goods sent for job work / processing
--   - Goods returned to supplier / from customer
--   - Consignment / exhibition / demo stock movement
--   - Direct C&F dispatch
--
-- A DC CANNOT substitute a tax invoice for a sale.
-- For sale with delivery challan, the tax invoice must follow.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE challan_purpose AS ENUM (
    'DELIVERY_AGAINST_INVOICE',   -- DC raised against an existing sales invoice
    'STOCK_TRANSFER',             -- intra-organisation branch/warehouse transfer
    'JOB_WORK_OUT',               -- goods sent for processing
    'JOB_WORK_RETURN',            -- processed goods received back
    'CONSIGNMENT_OUT',            -- goods sent on consignment
    'CONSIGNMENT_RETURN',         -- consignment returned
    'SALE_ON_APPROVAL',           -- goods sent for approval (not a sale yet)
    'EXHIBITION_DEMO',            -- goods for exhibition/demonstration
    'CF_DISPATCH',                -- direct dispatch from C&F warehouse
    'RETURN_TO_SUPPLIER',         -- goods being returned to supplier
    'OTHER_PERMITTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE challan_status AS ENUM (
    'DRAFT',
    'DISPATCHED',     -- goods left warehouse
    'DELIVERED',      -- delivery confirmed by recipient
    'RETURNED',       -- goods came back (consignment return, sale-on-approval rejection)
    'INVOICED',       -- subsequent tax invoice raised (for DC against invoice)
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE delivery_challans (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id       UUID          NOT NULL REFERENCES organisations(id),
  branch_id             UUID          REFERENCES branches(id),

  challan_number        TEXT          NOT NULL,
  challan_date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  purpose               challan_purpose NOT NULL,
  reference_no          TEXT,

  -- Source invoice (when purpose = DELIVERY_AGAINST_INVOICE)
  invoice_id            UUID          REFERENCES sales_invoices(id),

  -- From / To
  from_location         UUID          REFERENCES locations(id),
  to_location           UUID          REFERENCES locations(id),

  -- For party dispatch (customer or supplier)
  party_id              UUID          REFERENCES parties(id),
  party_name            TEXT,         -- for walk-in / external
  delivery_address      TEXT,

  -- Transport details
  vehicle_number        TEXT,
  driver_name           TEXT,
  transport_mode        TEXT          DEFAULT 'ROAD',  -- ROAD / RAIL / AIR / SHIP
  transporter_id        UUID          REFERENCES parties(id),
  lr_number             TEXT,         -- Lorry Receipt number
  lr_date               DATE,

  -- E-way bill
  eway_bill_number      TEXT,
  eway_bill_date        DATE,
  eway_bill_valid_upto  DATE,

  -- Financial (no GST on DC — non-tax document)
  total_qty             NUMERIC(15,3) NOT NULL DEFAULT 0,
  approximate_value     NUMERIC(15,2) NOT NULL DEFAULT 0,  -- for e-way bill only

  status                challan_status NOT NULL DEFAULT 'DRAFT',
  dispatched_at         TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  delivery_acknowledged_by TEXT,

  narration             TEXT,
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id),
  updated_by            UUID          REFERENCES auth.users(id),

  CONSTRAINT dc_number_unique UNIQUE (tenant_id, organisation_id, challan_number)
);

CREATE TABLE delivery_challan_lines (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id            UUID          NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  tenant_id             UUID          NOT NULL REFERENCES tenants(id),
  line_no               SMALLINT      NOT NULL,
  invoice_line_id       UUID          REFERENCES sales_invoice_lines(id),
  product_id            UUID          NOT NULL REFERENCES products(id),
  description           TEXT,
  batch_id              UUID          REFERENCES batch_register(id),
  batch_number          TEXT,
  qty                   NUMERIC(15,3) NOT NULL CHECK (qty > 0),
  unit_of_measure       TEXT          NOT NULL,
  approximate_unit_value NUMERIC(15,4) DEFAULT 0,
  CONSTRAINT dcl_line_unique UNIQUE (challan_id, line_no)
);

-- RLS
ALTER TABLE delivery_challans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challan_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_tenant_select" ON delivery_challans      FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "dc_tenant_insert" ON delivery_challans      FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "dc_tenant_update" ON delivery_challans      FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "dc_no_delete"     ON delivery_challans      FOR DELETE USING (FALSE);
CREATE POLICY "dcl_tenant_select" ON delivery_challan_lines FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "dcl_tenant_insert" ON delivery_challan_lines FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "dcl_no_delete"    ON delivery_challan_lines  FOR DELETE USING (FALSE);

CREATE INDEX idx_dc_party    ON delivery_challans(party_id, challan_date DESC);
CREATE INDEX idx_dc_status   ON delivery_challans(tenant_id, status);
CREATE INDEX idx_dc_invoice  ON delivery_challans(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_dcl_product ON delivery_challan_lines(product_id);

CREATE TRIGGER set_dc_updated_at BEFORE UPDATE ON delivery_challans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_dc_number(p_tenant_id UUID, p_org_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year TEXT := TO_CHAR(CURRENT_DATE,'YYYY'); v_count INTEGER;
BEGIN
  SELECT COUNT(*)+1 INTO v_count FROM delivery_challans
   WHERE tenant_id=p_tenant_id AND organisation_id=p_org_id AND challan_number LIKE 'DC-'||v_year||'-%';
  RETURN 'DC-'||v_year||'-'||LPAD(v_count::TEXT,5,'0');
END; $$;
