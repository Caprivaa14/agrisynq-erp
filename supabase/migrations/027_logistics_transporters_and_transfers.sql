-- ============================================================
-- Migration 027: Transporters & Stock Transfers
-- FartiLedger - ERP — Phase 6 Logistics & Custody Engine
-- ============================================================

BEGIN;

-- ── 1. Fix Stock Balance Location Resolution for Transfers ────
-- Ensures TRANSFER_OUT deducts from from_location_id while keeping both
-- from_location_id and to_location_id populated as required by constraint.
CREATE OR REPLACE VIEW public.stock_balance AS
SELECT
  tenant_id,
  organisation_id,
  product_id,
  batch_id,
  CASE
    WHEN movement_type IN ('SALE','RETURN_TO_SUPPLIER','TRANSFER_OUT','QUARANTINE_HOLD','ADJ_DECREASE','EXPIRY_WRITE_OFF','DAMAGE_WRITE_OFF','FMS_SUBSIDY_OUT')
      THEN COALESCE(from_location_id, to_location_id)
    ELSE COALESCE(to_location_id, from_location_id)
  END AS location_id,
  SUM(
    CASE
      WHEN movement_type IN ('GRN','OPENING','RETURN_FROM_SALE','TRANSFER_IN','QUARANTINE_RELEASE','ADJ_INCREASE','FMS_RETURN')
        THEN qty
      WHEN movement_type IN ('SALE','RETURN_TO_SUPPLIER','TRANSFER_OUT','QUARANTINE_HOLD','ADJ_DECREASE','EXPIRY_WRITE_OFF','DAMAGE_WRITE_OFF','FMS_SUBSIDY_OUT')
        THEN -qty
      ELSE 0
    END
  ) AS balance_qty,
  MAX(movement_date) AS last_movement_date
FROM public.stock_ledger
WHERE is_reversal = FALSE
GROUP BY
  tenant_id,
  organisation_id,
  product_id,
  batch_id,
  CASE
    WHEN movement_type IN ('SALE','RETURN_TO_SUPPLIER','TRANSFER_OUT','QUARANTINE_HOLD','ADJ_DECREASE','EXPIRY_WRITE_OFF','DAMAGE_WRITE_OFF','FMS_SUBSIDY_OUT')
      THEN COALESCE(from_location_id, to_location_id)
    ELSE COALESCE(to_location_id, from_location_id)
  END;

CREATE OR REPLACE FUNCTION public.get_stock_balance(
  p_tenant_id    UUID,
  p_product_id   UUID,
  p_location_id  UUID DEFAULT NULL,
  p_batch_id     UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN movement_type IN ('GRN','OPENING','RETURN_FROM_SALE','TRANSFER_IN','QUARANTINE_RELEASE','ADJ_INCREASE','FMS_RETURN')
        THEN qty
      WHEN movement_type IN ('SALE','RETURN_TO_SUPPLIER','TRANSFER_OUT','QUARANTINE_HOLD','ADJ_DECREASE','EXPIRY_WRITE_OFF','DAMAGE_WRITE_OFF','FMS_SUBSIDY_OUT')
        THEN -qty
      ELSE 0
    END
  ), 0)
  FROM public.stock_ledger
  WHERE tenant_id   = p_tenant_id
    AND product_id  = p_product_id
    AND is_reversal = FALSE
    AND (
      p_location_id IS NULL
      OR (
        CASE
          WHEN movement_type IN ('SALE','RETURN_TO_SUPPLIER','TRANSFER_OUT','QUARANTINE_HOLD','ADJ_DECREASE','EXPIRY_WRITE_OFF','DAMAGE_WRITE_OFF','FMS_SUBSIDY_OUT')
            THEN COALESCE(from_location_id, to_location_id)
          ELSE COALESCE(to_location_id, from_location_id)
        END
      ) = p_location_id
    )
    AND (p_batch_id IS NULL OR batch_id = p_batch_id);
$$;

-- ── 2. ENUMs ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE transfer_type_enum AS ENUM (
    'INTER_BRANCH',
    'CNF_TO_OWN_WAREHOUSE',
    'CNF_DIRECT_TO_CUSTOMER',
    'QUARANTINE_TRANSFER',
    'DAMAGE_TRANSFER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transfer_status_enum AS ENUM (
    'DRAFT',
    'APPROVED',
    'IN_TRANSIT',
    'RECEIVED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Transporters Master ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transporters (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organisation_id   UUID          NOT NULL REFERENCES public.organisations(id),
  branch_id         UUID          REFERENCES public.branches(id),

  transporter_code  TEXT          NOT NULL,
  legal_name        TEXT          NOT NULL,
  trade_name        TEXT,
  gstin             TEXT,         -- 15-char Transporter GSTIN / TRANSIN
  pan               TEXT,
  contact_person    TEXT,
  mobile            TEXT,
  email             TEXT,
  address           TEXT,
  state_code        TEXT,

  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by        UUID          REFERENCES auth.users(id),
  updated_by        UUID          REFERENCES auth.users(id),

  CONSTRAINT uq_transporter_code UNIQUE (tenant_id, organisation_id, transporter_code)
);

ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transporters_tenant_select" ON public.transporters
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "transporters_tenant_insert" ON public.transporters
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "transporters_tenant_update" ON public.transporters
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "transporters_no_delete" ON public.transporters
  FOR DELETE USING (FALSE);

CREATE TRIGGER set_transporters_updated_at
  BEFORE UPDATE ON public.transporters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Stock Transfers Header ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id                        UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID                 NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organisation_id           UUID                 NOT NULL REFERENCES public.organisations(id),
  branch_id                 UUID                 REFERENCES public.branches(id),

  transfer_no               TEXT                 NOT NULL,
  transfer_date             DATE                 NOT NULL DEFAULT CURRENT_DATE,
  transfer_type             transfer_type_enum   NOT NULL DEFAULT 'INTER_BRANCH',
  status                    transfer_status_enum NOT NULL DEFAULT 'DRAFT',

  source_location_id        UUID                 NOT NULL REFERENCES public.locations(id),
  destination_location_id   UUID                 NOT NULL REFERENCES public.locations(id),

  -- C&F Specific References
  cf_agent_id               UUID                 REFERENCES public.parties(id),
  cnf_withdrawal_req_no     TEXT,
  cnf_company_approval_ref  TEXT,
  cnf_delivery_order_no     TEXT,

  -- Logistics & E-Way Bill
  transporter_id            UUID                 REFERENCES public.transporters(id),
  vehicle_no                TEXT,
  driver_name               TEXT,
  driver_mobile             TEXT,
  lr_rr_no                  TEXT,
  lr_date                   DATE,
  eway_bill_no              TEXT,
  eway_bill_valid_until     TIMESTAMPTZ,

  remarks                   TEXT,
  dispatched_at             TIMESTAMPTZ,
  dispatched_by             UUID                 REFERENCES auth.users(id),
  received_at               TIMESTAMPTZ,
  received_by               UUID                 REFERENCES auth.users(id),

  created_at                TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  created_by                UUID                 REFERENCES auth.users(id),
  updated_by                UUID                 REFERENCES auth.users(id),

  CONSTRAINT uq_transfer_no UNIQUE (tenant_id, organisation_id, transfer_no),
  CONSTRAINT chk_transfer_diff_locations CHECK (source_location_id <> destination_location_id)
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_transfers_tenant_select" ON public.stock_transfers
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "stock_transfers_tenant_insert" ON public.stock_transfers
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "stock_transfers_tenant_update" ON public.stock_transfers
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "stock_transfers_no_delete" ON public.stock_transfers
  FOR DELETE USING (FALSE);

CREATE TRIGGER set_stock_transfers_updated_at
  BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. Stock Transfer Line Items ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_id       UUID          NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id        UUID          NOT NULL REFERENCES public.products(id),
  source_batch_id   UUID          NOT NULL REFERENCES public.batch_register(id),
  dest_batch_id     UUID          REFERENCES public.batch_register(id),
  unit_of_measure   TEXT          NOT NULL,

  requested_qty     NUMERIC(15,3) NOT NULL CHECK (requested_qty > 0),
  dispatched_qty    NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
  received_qty      NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  shortage_qty      NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (shortage_qty >= 0),
  damaged_qty       NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),

  unit_cost         NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  remarks           TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dispatch_le_req CHECK (dispatched_qty <= requested_qty),
  CONSTRAINT chk_recv_reconcile CHECK ((received_qty + shortage_qty + damaged_qty) <= dispatched_qty)
);

ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_items_tenant_select" ON public.stock_transfer_items
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "transfer_items_tenant_insert" ON public.stock_transfer_items
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "transfer_items_tenant_update" ON public.stock_transfer_items
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "transfer_items_no_delete" ON public.stock_transfer_items
  FOR DELETE USING (FALSE);

CREATE INDEX idx_transfer_items_parent ON public.stock_transfer_items(transfer_id);

COMMIT;