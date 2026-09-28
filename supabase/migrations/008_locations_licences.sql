-- ============================================================
-- Migration 008: Locations & Licences
-- AgriSynq ERP
-- ============================================================

-- ── locations ────────────────────────────────────────────────
CREATE TYPE location_type_enum AS ENUM ('OWN', 'CF_DEPOT', 'QUARANTINE', 'VIRTUAL');

CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  location_type   location_type_enum NOT NULL,
  address         TEXT,
  state           TEXT,
  pincode         TEXT,
  capacity_sqft   NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Name uniqueness per organisation
  UNIQUE(tenant_id, organisation_id, name)
);

-- ── licences ─────────────────────────────────────────────────
CREATE TYPE licence_type_enum AS ENUM ('FERTILIZER', 'PESTICIDE', 'SEED', 'RETAIL');

CREATE TABLE licences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  licence_number  TEXT NOT NULL,
  licence_type    licence_type_enum NOT NULL,
  valid_from      DATE NOT NULL,
  valid_to        DATE NOT NULL,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  party_id        UUID REFERENCES parties(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, organisation_id, licence_number)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_locations_org ON locations(tenant_id, organisation_id);
CREATE INDEX idx_licences_org ON licences(tenant_id, organisation_id);
CREATE INDEX idx_licences_location ON licences(location_id);
CREATE INDEX idx_licences_party ON licences(party_id);

-- ── RLS Policies ──────────────────────────────────────────────
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE licences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
ON locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON locations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON locations FOR DELETE TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" 
ON licences FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" 
ON licences FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" 
ON licences FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" 
ON licences FOR DELETE TO authenticated USING (true);
