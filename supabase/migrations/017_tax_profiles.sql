-- ============================================================
-- Migration 017: Tax Profiles — GST rate master
-- FertiLedger ERP
-- ============================================================
-- Tax profiles define the applicable GST rate for each
-- product category / HSN code combination with effective dates.
-- This supports GST rate changes without modifying product records.
-- ============================================================

CREATE TABLE tax_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- What this rate applies to
  product_category    TEXT,                       -- NULL = applies to all categories with this HSN
  hsn_code            TEXT,                       -- 4–8 digit HSN / SAC code
  description         TEXT,                       -- human-readable description

  -- GST rates
  gst_rate            NUMERIC(5,2) NOT NULL,       -- total GST % (e.g. 18)
  cgst_rate           NUMERIC(5,2) NOT NULL,       -- CGST % = gst_rate / 2 for intra-state
  sgst_rate           NUMERIC(5,2) NOT NULL,       -- SGST / UTGST %
  igst_rate           NUMERIC(5,2) NOT NULL,       -- IGST % = cgst + sgst for inter-state
  cess_rate           NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Tax status
  is_exempt           BOOLEAN      NOT NULL DEFAULT FALSE,
  is_nil_rated        BOOLEAN      NOT NULL DEFAULT FALSE,
  exemption_reason    TEXT,                       -- legal basis for exemption

  -- Date effectivity
  effective_from      DATE         NOT NULL,
  effective_to        DATE,                       -- NULL = currently effective

  -- Audit
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by          UUID         REFERENCES auth.users(id),

  -- Integrity checks
  CONSTRAINT gst_rate_non_negative CHECK (gst_rate >= 0),
  CONSTRAINT cess_rate_non_negative CHECK (cess_rate >= 0),
  CONSTRAINT valid_effective_range  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT gst_rate_components    CHECK (
    ABS(cgst_rate + sgst_rate - gst_rate) < 0.01  -- allow minor float rounding
  )
);

-- RLS
ALTER TABLE tax_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_profiles_tenant_select" ON tax_profiles
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tax_profiles_tenant_insert" ON tax_profiles
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "tax_profiles_tenant_update" ON tax_profiles
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "tax_profiles_no_delete" ON tax_profiles
  FOR DELETE USING (FALSE);

-- Indexes
CREATE INDEX idx_tax_profiles_hsn ON tax_profiles(tenant_id, hsn_code, effective_from);
CREATE INDEX idx_tax_profiles_cat ON tax_profiles(tenant_id, product_category);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_tax_profiles_updated_at ON tax_profiles;
CREATE TRIGGER set_tax_profiles_updated_at
  BEFORE UPDATE ON tax_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Helper: get applicable GST rate for a product ────────────
-- Returns the currently effective tax profile for an HSN code.
CREATE OR REPLACE FUNCTION public.get_tax_rate(
  p_tenant_id   UUID,
  p_hsn_code    TEXT,
  p_as_of_date  DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  gst_rate    NUMERIC,
  cgst_rate   NUMERIC,
  sgst_rate   NUMERIC,
  igst_rate   NUMERIC,
  cess_rate   NUMERIC,
  is_exempt   BOOLEAN,
  is_nil_rated BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gst_rate, cgst_rate, sgst_rate, igst_rate, cess_rate, is_exempt, is_nil_rated
  FROM   tax_profiles
  WHERE  tenant_id    = p_tenant_id
    AND  hsn_code     = p_hsn_code
    AND  is_active    = TRUE
    AND  effective_from <= p_as_of_date
    AND  (effective_to IS NULL OR effective_to >= p_as_of_date)
  ORDER BY effective_from DESC
  LIMIT 1;
$$;

-- ── Seed: Common fertilizer & agriculture GST rates ──────────
-- NOTE: These are example seeds for the system tenant (tenant_id = nil placeholder).
-- Real tenant rates must be configured by the admin after onboarding.
-- The insert below is COMMENTED OUT — admin must configure their own tenant rates.

-- Example structure (uncomment and replace with actual tenant_id):
-- INSERT INTO tax_profiles (tenant_id, hsn_code, description, gst_rate, cgst_rate, sgst_rate, igst_rate, effective_from) VALUES
-- ('YOUR-TENANT-UUID', '3102', 'Nitrogenous Fertilizers (Urea, etc.)', 5, 2.5, 2.5, 5, '2017-07-01'),
-- ('YOUR-TENANT-UUID', '3104', 'Potassic Fertilizers (MOP, etc.)', 5, 2.5, 2.5, 5, '2017-07-01'),
-- ('YOUR-TENANT-UUID', '3105', 'Complex Fertilizers (NPK, DAP, etc.)', 5, 2.5, 2.5, 5, '2017-07-01'),
-- ('YOUR-TENANT-UUID', '3808', 'Pesticides / Insecticides', 18, 9, 9, 18, '2017-07-01'),
-- ('YOUR-TENANT-UUID', '1209', 'Seeds', 0, 0, 0, 0, '2017-07-01');
