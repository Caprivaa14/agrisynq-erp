-- ============================================================
-- Migration 006: Master Data (Parties & Products)
-- AgriSynq ERP
-- ============================================================

-- ── parties ──────────────────────────────────────────────────
CREATE TYPE party_type_enum AS ENUM ('CUSTOMER', 'SUPPLIER', 'CF_AGENT', 'BOTH');

CREATE TABLE parties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  party_type      party_type_enum NOT NULL,
  gstin           TEXT,
  fms_dealer_id   TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  state           TEXT,
  pincode         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, organisation_id, gstin)
);

-- ── products ─────────────────────────────────────────────────
CREATE TYPE product_category_enum AS ENUM ('FERTILIZER', 'PESTICIDE', 'SEED', 'OTHER');

CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         product_category_enum NOT NULL,
  hsn_code         TEXT NOT NULL,
  unit_of_measure  TEXT NOT NULL,
  gst_rate         NUMERIC NOT NULL,
  mrp              NUMERIC,
  selling_price    NUMERIC,
  purchase_price   NUMERIC,
  fms_product_code TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, organisation_id, name)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_parties_org ON parties(tenant_id, organisation_id);
CREATE INDEX idx_products_org ON products(tenant_id, organisation_id);

-- ── RLS Policies ──────────────────────────────────────────────
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Note: In a real multi-tenant system, these policies should ideally 
-- restrict access based on auth.uid() and user's tenant_id. 
-- For now, enabling basic authenticated access.
CREATE POLICY "Enable read access for authenticated users" 
ON parties FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON parties FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON parties FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON parties FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" 
ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON products FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON products FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON products FOR DELETE TO authenticated USING (true);
