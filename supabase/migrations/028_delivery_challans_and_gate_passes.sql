-- ============================================================
-- Migration 028: Delivery Challans, Gate Passes & Transfer RPCs
-- FartiLedger - ERP — Phase 6 Logistics & Custody Engine
-- ============================================================

BEGIN;

-- ── 1. ENUMs ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE challan_purpose_enum AS ENUM (
    'BILL_TO_SHIP_TO',
    'CNF_DIRECT_DISPATCH',
    'STOCK_TRANSFER',
    'SALES_ON_APPROVAL',
    'EXHIBITION_OR_DEMO',
    'OTHER_LAWFUL_MOVEMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE challan_status_enum AS ENUM (
    'DRAFT',
    'DISPATCHED',
    'DELIVERED',
    'INVOICED',
    'RETURNED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gate_pass_type_enum AS ENUM (
    'OUTWARD_SALE',
    'OUTWARD_TRANSFER',
    'OUTWARD_RETURN',
    'INWARD_PURCHASE',
    'INWARD_TRANSFER',
    'INWARD_SALES_RETURN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Delivery Challans ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_challans (
  id                      UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID                 NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organisation_id         UUID                 NOT NULL REFERENCES public.organisations(id),
  branch_id               UUID                 REFERENCES public.branches(id),

  challan_no              TEXT                 NOT NULL,
  challan_date            DATE                 NOT NULL DEFAULT CURRENT_DATE,
  purpose                 challan_purpose_enum NOT NULL,
  status                  challan_status_enum  NOT NULL DEFAULT 'DRAFT',

  dispatch_location_id    UUID                 NOT NULL REFERENCES public.locations(id),
  stock_transfer_id       UUID                 REFERENCES public.stock_transfers(id),
  sales_invoice_id        UUID,                -- Links to sales_invoices when applicable

  -- Bill-To / Ship-To Separation
  bill_to_party_id        UUID                 REFERENCES public.parties(id),
  ship_to_party_id        UUID                 REFERENCES public.parties(id),
  consignee_name          TEXT,
  consignee_gstin         TEXT,
  delivery_address        TEXT                 NOT NULL,
  place_of_supply_state   TEXT                 NOT NULL,

  -- Transport & E-Way Bill
  transporter_id          UUID                 REFERENCES public.transporters(id),
  vehicle_no              TEXT,
  driver_name             TEXT,
  driver_mobile           TEXT,
  distance_km             NUMERIC(8,2),
  eway_bill_no            TEXT,
  eway_bill_valid_until   TIMESTAMPTZ,

  -- Proof of Delivery
  pod_received            BOOLEAN              NOT NULL DEFAULT FALSE,
  pod_received_at         TIMESTAMPTZ,
  pod_receiver_name       TEXT,
  remarks                 TEXT,

  created_at              TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  created_by              UUID                 REFERENCES auth.users(id),
  updated_by              UUID                 REFERENCES auth.users(id),

  CONSTRAINT uq_challan_no UNIQUE (tenant_id, organisation_id, challan_no)
);

ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challans_tenant_select" ON public.delivery_challans
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "challans_tenant_insert" ON public.delivery_challans
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "challans_tenant_update" ON public.delivery_challans
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "challans_no_delete" ON public.delivery_challans
  FOR DELETE USING (FALSE);

CREATE TRIGGER set_challans_updated_at
  BEFORE UPDATE ON public.delivery_challans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Delivery Challan Line Items ────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_challan_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  challan_id          UUID          NOT NULL REFERENCES public.delivery_challans(id) ON DELETE CASCADE,
  product_id          UUID          NOT NULL REFERENCES public.products(id),
  batch_id            UUID          NOT NULL REFERENCES public.batch_register(id),
  unit_of_measure     TEXT          NOT NULL,
  qty                 NUMERIC(15,3) NOT NULL CHECK (qty > 0),
  declared_unit_rate  NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (declared_unit_rate >= 0),
  remarks             TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_challan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challan_items_tenant_select" ON public.delivery_challan_items
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "challan_items_tenant_insert" ON public.delivery_challan_items
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "challan_items_no_delete" ON public.delivery_challan_items
  FOR DELETE USING (FALSE);

-- ── 4. Gate Passes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gate_passes (
  id                    UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID                NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organisation_id       UUID                NOT NULL REFERENCES public.organisations(id),
  location_id           UUID                NOT NULL REFERENCES public.locations(id),

  gate_pass_no          TEXT                NOT NULL,
  pass_type             gate_pass_type_enum NOT NULL,
  pass_date             TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

  reference_doc_type    TEXT                NOT NULL, -- 'STOCK_TRANSFER' | 'DELIVERY_CHALLAN' | 'SALE_INVOICE' | 'GRN'
  reference_doc_id      UUID                NOT NULL,
  reference_doc_no      TEXT                NOT NULL,

  vehicle_no            TEXT                NOT NULL,
  driver_name           TEXT,
  driver_mobile         TEXT,
  total_packages        INTEGER             CHECK (total_packages >= 0),
  security_officer_name TEXT,
  remarks               TEXT,

  created_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  created_by            UUID                REFERENCES auth.users(id),

  CONSTRAINT uq_gate_pass_no UNIQUE (tenant_id, organisation_id, gate_pass_no)
);

ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gate_passes_tenant_select" ON public.gate_passes
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "gate_passes_tenant_insert" ON public.gate_passes
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "gate_passes_no_delete" ON public.gate_passes
  FOR DELETE USING (FALSE);

-- ── 5. Atomic RPC: Dispatch Stock Transfer ────────────────────
-- Deducts batch_register.current_qty at source and writes TRANSFER_OUT to stock_ledger
CREATE OR REPLACE FUNCTION public.rpc_dispatch_stock_transfer(
  p_tenant_id   UUID,
  p_transfer_id UUID,
  p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_transfer RECORD;
  v_item     RECORD;
  v_avail    NUMERIC;
BEGIN
  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock transfer not found';
  END IF;

  IF v_transfer.status NOT IN ('DRAFT', 'APPROVED') THEN
    RAISE EXCEPTION 'Only DRAFT or APPROVED transfers can be dispatched (current: %)', v_transfer.status;
  END IF;

  -- Check period lock
  PERFORM public.assert_period_not_locked(p_tenant_id, v_transfer.organisation_id, v_transfer.transfer_date, 'FINANCIAL');

  FOR v_item IN
    SELECT * FROM public.stock_transfer_items
    WHERE transfer_id = p_transfer_id AND tenant_id = p_tenant_id
  LOOP
    -- Check stock availability
    v_avail := public.get_stock_balance(p_tenant_id, v_item.product_id, v_transfer.source_location_id, v_item.source_batch_id);
    IF v_avail < v_item.requested_qty THEN
      RAISE EXCEPTION 'Insufficient stock for batch % (Available: %, Requested: %)',
        v_item.source_batch_id, v_avail, v_item.requested_qty;
    END IF;

    -- Update item dispatched_qty
    UPDATE public.stock_transfer_items
    SET dispatched_qty = requested_qty
    WHERE id = v_item.id;

    -- Deduct from source batch_register
    UPDATE public.batch_register
    SET current_qty = current_qty - v_item.requested_qty,
        updated_by  = p_user_id
    WHERE id = v_item.source_batch_id AND tenant_id = p_tenant_id;

    -- If C&F withdrawal, deduct from cf_stock_register as well
    IF v_transfer.transfer_type = 'CNF_TO_OWN_WAREHOUSE' THEN
      UPDATE public.cf_stock_register
      SET qty_held   = GREATEST(0, qty_held - v_item.requested_qty),
          updated_by = p_user_id
      WHERE tenant_id   = p_tenant_id
        AND location_id = v_transfer.source_location_id
        AND product_id  = v_item.product_id
        AND batch_id    = v_item.source_batch_id;
    END IF;

    -- Insert immutable TRANSFER_OUT into stock_ledger
    INSERT INTO public.stock_ledger (
      tenant_id, organisation_id, branch_id,
      movement_type, movement_date,
      product_id, batch_id,
      from_location_id, to_location_id,
      qty, unit_of_measure, rate_per_unit,
      source_document_type, source_document_id, source_document_no,
      narration, created_by
    ) VALUES (
      p_tenant_id, v_transfer.organisation_id, v_transfer.branch_id,
      'TRANSFER_OUT', v_transfer.transfer_date,
      v_item.product_id, v_item.source_batch_id,
      v_transfer.source_location_id, v_transfer.destination_location_id,
      v_item.requested_qty, v_item.unit_of_measure, v_item.unit_cost,
      'TRANSFER', v_transfer.id, v_transfer.transfer_no,
      'Stock Transfer Outward: ' || v_transfer.transfer_no, p_user_id
    );
  END LOOP;

  UPDATE public.stock_transfers
  SET status        = 'IN_TRANSIT',
      dispatched_at = NOW(),
      dispatched_by = p_user_id,
      updated_by    = p_user_id
  WHERE id = p_transfer_id;
END;
$$;

-- ── 6. Atomic RPC: Receive Stock Transfer ─────────────────────
-- Posts TRANSFER_IN to destination location and updates/creates destination batch
CREATE OR REPLACE FUNCTION public.rpc_receive_stock_transfer(
  p_tenant_id   UUID,
  p_transfer_id UUID,
  p_user_id     UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_transfer   RECORD;
  v_item       RECORD;
  v_src_batch  RECORD;
  v_dest_batch UUID;
BEGIN
  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock transfer not found';
  END IF;

  IF v_transfer.status <> 'IN_TRANSIT' THEN
    RAISE EXCEPTION 'Only IN_TRANSIT transfers can be received (current: %)', v_transfer.status;
  END IF;

  FOR v_item IN
    SELECT * FROM public.stock_transfer_items
    WHERE transfer_id = p_transfer_id AND tenant_id = p_tenant_id
  LOOP
    SELECT * INTO v_src_batch
    FROM public.batch_register
    WHERE id = v_item.source_batch_id AND tenant_id = p_tenant_id;

    -- Update item received_qty = dispatched_qty (standard full receipt)
    UPDATE public.stock_transfer_items
    SET received_qty  = dispatched_qty,
        dest_batch_id = v_item.source_batch_id
    WHERE id = v_item.id;

    -- Insert immutable TRANSFER_IN into stock_ledger at destination location
    INSERT INTO public.stock_ledger (
      tenant_id, organisation_id, branch_id,
      movement_type, movement_date,
      product_id, batch_id,
      from_location_id, to_location_id,
      qty, unit_of_measure, rate_per_unit,
      source_document_type, source_document_id, source_document_no,
      narration, created_by
    ) VALUES (
      p_tenant_id, v_transfer.organisation_id, v_transfer.branch_id,
      'TRANSFER_IN', CURRENT_DATE,
      v_item.product_id, v_item.source_batch_id,
      v_transfer.source_location_id, v_transfer.destination_location_id,
      v_item.dispatched_qty, v_item.unit_of_measure, v_item.unit_cost,
      'TRANSFER', v_transfer.id, v_transfer.transfer_no,
      'Stock Transfer Inward: ' || v_transfer.transfer_no, p_user_id
    );

    -- Restore/increment batch_register qty for availability tracking
    UPDATE public.batch_register
    SET current_qty = current_qty + v_item.dispatched_qty,
        location_id = v_transfer.destination_location_id,
        status      = 'OPEN',
        updated_by  = p_user_id
    WHERE id = v_item.source_batch_id AND tenant_id = p_tenant_id;
  END LOOP;

  UPDATE public.stock_transfers
  SET status      = 'RECEIVED',
      received_at = NOW(),
      received_by = p_user_id,
      updated_by  = p_user_id
  WHERE id = p_transfer_id;
END;
$$;

COMMIT;