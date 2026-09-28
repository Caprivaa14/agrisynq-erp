-- ============================================================
-- Migration 018: Units of Measure (UoM) Master
-- FertiLedger ERP
-- ============================================================
-- Stores approved units of measure and conversion ratios.
-- Used by products, stock ledger, and purchase/sales line items.
-- ============================================================

CREATE TABLE units_of_measure (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Unit definition
  code            TEXT        NOT NULL,           -- e.g. 'KG', 'MT', 'LIT', 'BAG'
  name            TEXT        NOT NULL,           -- e.g. 'Kilogram', 'Metric Ton', 'Litre'
  symbol          TEXT,                           -- e.g. 'kg', 'MT', 'L'

  -- Classification
  uom_type        TEXT        NOT NULL DEFAULT 'WEIGHT'  -- WEIGHT | VOLUME | COUNT | LENGTH | OTHER
                  CHECK (uom_type IN ('WEIGHT','VOLUME','COUNT','LENGTH','OTHER')),

  -- Conversion to base unit (for automatic conversions)
  -- base_unit_code = NULL means this IS the base unit for its type
  base_unit_code  TEXT,                           -- e.g. 'KG' is base for weight
  conversion_factor NUMERIC(18,6),                -- 1 of this unit = ? of base unit

  -- GST / regulatory code
  gst_uom_code    TEXT,                           -- as per GST portal unit codes

  -- Status
  is_system       BOOLEAN     NOT NULL DEFAULT FALSE,  -- system units can't be deleted
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES auth.users(id),

  UNIQUE(tenant_id, code)
);

-- RLS
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uom_tenant_select" ON units_of_measure
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "uom_tenant_insert" ON units_of_measure
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "uom_tenant_update" ON units_of_measure
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- System UoM cannot be deleted; custom can be soft-archived
CREATE POLICY "uom_no_delete" ON units_of_measure
  FOR DELETE USING (FALSE);

CREATE INDEX idx_uom_tenant ON units_of_measure(tenant_id, is_active);

DROP TRIGGER IF EXISTS set_uom_updated_at ON units_of_measure;
CREATE TRIGGER set_uom_updated_at
  BEFORE UPDATE ON units_of_measure
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Function: seed standard UoM for a tenant ─────────────────
-- Call this during tenant onboarding to pre-populate standard units.
CREATE OR REPLACE FUNCTION public.seed_standard_uom(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO units_of_measure (tenant_id, code, name, symbol, uom_type, base_unit_code, conversion_factor, gst_uom_code, is_system) VALUES
    -- Weight
    (p_tenant_id, 'KG',   'Kilogram',       'kg',  'WEIGHT', 'KG',  1,       'KGS', TRUE),
    (p_tenant_id, 'GM',   'Gram',           'g',   'WEIGHT', 'KG',  0.001,   'GMS', TRUE),
    (p_tenant_id, 'MT',   'Metric Ton',     'MT',  'WEIGHT', 'KG',  1000,    'MT',  TRUE),
    (p_tenant_id, 'QT',   'Quintal',        'qtl', 'WEIGHT', 'KG',  100,     'QTL', TRUE),
    (p_tenant_id, 'BAG',  'Bag (50 kg)',    'bag', 'WEIGHT', 'KG',  50,      'BAG', TRUE),
    (p_tenant_id, 'BAG40','Bag (40 kg)',    'bag', 'WEIGHT', 'KG',  40,      'BAG', FALSE),
    (p_tenant_id, 'BAG25','Bag (25 kg)',    'bag', 'WEIGHT', 'KG',  25,      'BAG', FALSE),
    -- Volume
    (p_tenant_id, 'LIT',  'Litre',          'L',   'VOLUME', 'LIT', 1,       'LTR', TRUE),
    (p_tenant_id, 'ML',   'Millilitre',     'mL',  'VOLUME', 'LIT', 0.001,   'MLT', TRUE),
    -- Count / packs
    (p_tenant_id, 'NOS',  'Numbers',        'nos', 'COUNT',  'NOS', 1,       'NOS', TRUE),
    (p_tenant_id, 'PKT',  'Packet',         'pkt', 'COUNT',  'NOS', 1,       'PAC', TRUE),
    (p_tenant_id, 'BTL',  'Bottle',         'btl', 'COUNT',  'NOS', 1,       'BTL', TRUE),
    (p_tenant_id, 'BOX',  'Box',            'box', 'COUNT',  'NOS', 1,       'BOX', TRUE),
    (p_tenant_id, 'SET',  'Set',            'set', 'COUNT',  'NOS', 1,       'SET', TRUE)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- ── NOTE for onboarding ───────────────────────────────────────
-- After creating a new tenant, call:
-- SELECT public.seed_standard_uom('YOUR-TENANT-UUID');
-- SELECT public.onboard_tenant('YOUR-TENANT-UUID', 'Company Name');
