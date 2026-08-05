-- ============================================================
-- Migration 002: Tenants, Organisations, Branches, Financial Years
-- AgriSynq ERP
-- ============================================================

-- ── tenants ──────────────────────────────────────────────────
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'trial'
                CHECK (plan IN ('trial', 'standard', 'enterprise')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── organisations (legal entities) ───────────────────────────
CREATE TABLE organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  legal_name      TEXT NOT NULL,
  trade_name      TEXT,
  gstin           TEXT,
  pan             TEXT,
  cin             TEXT,
  address         JSONB NOT NULL DEFAULT '{}',
  fms_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  ifms_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  default_state   TEXT NOT NULL DEFAULT 'Maharashtra',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (tenant_id, gstin)
);

-- ── branches ─────────────────────────────────────────────────
CREATE TABLE branches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  organisation_id       UUID NOT NULL REFERENCES organisations(id),
  name                  TEXT NOT NULL,
  code                  TEXT NOT NULL,
  gstin                 TEXT,
  address               JSONB NOT NULL DEFAULT '{}',
  default_warehouse_id  UUID,    -- FK added after warehouses table in migration 006
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, organisation_id, code)
);

-- ── financial_years ──────────────────────────────────────────
CREATE TABLE financial_years (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  label           TEXT NOT NULL,       -- e.g., '2025-26'
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, organisation_id, label),
  CONSTRAINT valid_fy_dates CHECK (end_date > start_date)
);

-- Only one financial year can be current per org
CREATE UNIQUE INDEX idx_one_current_fy
  ON financial_years (tenant_id, organisation_id)
  WHERE is_current = TRUE;

-- ── invoice_series ────────────────────────────────────────────
CREATE TABLE invoice_series (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  series_type       TEXT NOT NULL
    CHECK (series_type IN (
      'TAX_INVOICE','CREDIT_NOTE','DEBIT_NOTE',
      'DELIVERY_CHALLAN','GATE_PASS','PURCHASE_ORDER',
      'SALES_ORDER','MEMO_INVOICE','MEMO_PURCHASE',
      'STOCK_TRANSFER','STOCK_ADJUSTMENT','GRN'
    )),
  prefix            TEXT NOT NULL,
  suffix            TEXT,
  current_seq       BIGINT NOT NULL DEFAULT 0,
  reset_on_fy       BOOLEAN NOT NULL DEFAULT TRUE,
  financial_year_id UUID REFERENCES financial_years(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, branch_id, series_type, financial_year_id)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_organisations_tenant ON organisations(tenant_id);
CREATE INDEX idx_branches_tenant ON branches(tenant_id, organisation_id);
CREATE INDEX idx_financial_years_tenant ON financial_years(tenant_id, organisation_id);
