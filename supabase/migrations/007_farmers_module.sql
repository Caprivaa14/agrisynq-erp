-- ============================================================
-- Migration 007: Farmers Module
-- AgriSynq ERP
-- ============================================================

CREATE TABLE farmers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  phone           TEXT,
  aadhaar_number  TEXT,
  village         TEXT,
  land_area_acres NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- A phone number should generally be unique per organisation for a farmer
  UNIQUE(tenant_id, organisation_id, phone)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_farmers_org ON farmers(tenant_id, organisation_id);

-- ── RLS Policies ──────────────────────────────────────────────
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
ON farmers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON farmers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON farmers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON farmers FOR DELETE TO authenticated USING (true);
