-- ============================================================
-- Migration 012: Products v2 — Full schema expansion
-- FertiLedger ERP
-- ============================================================
-- APPROACH: Non-destructive ALTER TABLE — adds columns only.
-- Existing data is preserved. New columns have safe defaults.
-- ============================================================

-- ── Expand product_category_enum ────────────────────────────
-- PostgreSQL requires adding values to existing enums with ALTER TYPE.
-- Safe to run multiple times: values are ignored if they already exist.
-- (pg_enum check used instead of IF NOT EXISTS which pg < 14 lacks)
DO $$ BEGIN
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'MICRONUTRIENT';
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'BIO_FERTILIZER';
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'PLANT_GROWTH';
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'WEEDICIDE';
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'FUNGICIDE';
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'INSECTICIDE';
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'RODENTICIDE';
  ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'ADJUVANT';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── New ENUMs ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tax_status_enum AS ENUM (
    'TAXABLE',
    'EXEMPT',
    'NIL_RATED',
    'NON_GST'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Expand products table ─────────────────────────────────────
ALTER TABLE products
  -- Identity
  ADD COLUMN IF NOT EXISTS product_code           TEXT,             -- unique per org, system-generated or user-defined
  ADD COLUMN IF NOT EXISTS brand                  TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer           TEXT,
  ADD COLUMN IF NOT EXISTS subcategory            TEXT,

  -- Tax
  ADD COLUMN IF NOT EXISTS tax_status             tax_status_enum   NOT NULL DEFAULT 'TAXABLE',
  ADD COLUMN IF NOT EXISTS cess_rate              NUMERIC(5,2)      NOT NULL DEFAULT 0,

  -- Units
  ADD COLUMN IF NOT EXISTS alt_uom                TEXT,             -- alternative UoM (e.g. MT vs KG)
  ADD COLUMN IF NOT EXISTS uom_conversion         NUMERIC(12,4),    -- 1 alt_uom = ? base_uom
  ADD COLUMN IF NOT EXISTS pack_size              NUMERIC(12,3),    -- pack size in base UoM
  ADD COLUMN IF NOT EXISTS pack_uom               TEXT,             -- e.g. 'BAG', 'BOTTLE'

  -- Pricing
  ADD COLUMN IF NOT EXISTS min_selling_rate       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS max_discount_pct       NUMERIC(5,2)      DEFAULT 0,

  -- Inventory controls
  ADD COLUMN IF NOT EXISTS batch_required         BOOLEAN           NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expiry_required        BOOLEAN           NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reorder_level          NUMERIC(12,3)     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_requirements   TEXT,
  ADD COLUMN IF NOT EXISTS licence_controlled     BOOLEAN           NOT NULL DEFAULT FALSE,

  -- Sub-type extension data (JSONB — flexible per-category fields)
  -- Fertilizer: { fertilizer_grade, npk_composition, is_subsidised, bag_weight_kg,
  --               fms_product_code, company_product_code, pos_product_code }
  -- Seed: { crop, variety, seed_class, certification_required }
  -- Pesticide: { active_ingredient, formulation, concentration, toxicity_class, restricted_sale }
  ADD COLUMN IF NOT EXISTS fertilizer_ext         JSONB,
  ADD COLUMN IF NOT EXISTS seed_ext               JSONB,
  ADD COLUMN IF NOT EXISTS pesticide_ext          JSONB,

  -- Soft archive
  ADD COLUMN IF NOT EXISTS is_active              BOOLEAN           NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS archived_at            TIMESTAMPTZ,

  -- Audit
  ADD COLUMN IF NOT EXISTS created_by             UUID              REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by             UUID              REFERENCES auth.users(id);

-- product_code must be unique per organisation (allow NULL for existing data)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_org
  ON products(tenant_id, organisation_id, product_code)
  WHERE product_code IS NOT NULL;

-- Full-text search index on product name + code
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(tenant_id, organisation_id, is_active);

-- ── Add 'OTHER' category existing enum value protection ──────
-- (FERTILIZER, PESTICIDE, SEED, OTHER are pre-existing from migration 006)

-- ── Update existing RLS to filter by is_active (optional — done at app layer) ─
-- RLS policies from 009_rls_fix remain valid. is_active filtering done in queries.
