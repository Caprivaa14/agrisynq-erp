-- ============================================================================
-- Migration 030: Payment Receipts + Receipt Allocations
-- ============================================================================

CREATE TYPE receipt_type_enum AS ENUM ('RECEIPT', 'PAYMENT');

CREATE TYPE payment_mode_enum AS ENUM (
  'CASH', 'CHEQUE', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'DD', 'OTHER'
);

CREATE TYPE receipt_status_enum AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- ─── Payment Receipts ────────────────────────────────────────────────────────
CREATE TABLE payment_receipts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  organisation_id       UUID NOT NULL,
  branch_id             UUID,

  receipt_no            TEXT NOT NULL,
  receipt_date          DATE NOT NULL,
  receipt_type          receipt_type_enum NOT NULL,   -- RECEIPT = money IN, PAYMENT = money OUT

  -- Counterparty
  party_id              UUID NOT NULL,   -- customer (RECEIPT) or supplier (PAYMENT)

  -- Banking
  bank_account_id       UUID REFERENCES chart_of_accounts(id),   -- which bank/cash account
  payment_mode          payment_mode_enum NOT NULL DEFAULT 'CASH',
  amount                NUMERIC(18,2) NOT NULL CHECK (amount > 0),

  -- Instrument details
  cheque_no             TEXT,
  cheque_date           DATE,
  bank_name             TEXT,
  utr_no                TEXT,   -- for NEFT/RTGS/IMPS/UPI

  narration             TEXT,
  status                receipt_status_enum NOT NULL DEFAULT 'DRAFT',

  -- Auto-created JV on posting
  journal_voucher_id    UUID REFERENCES journal_vouchers(id),

  created_by            UUID,
  updated_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_receipt_no_tenant UNIQUE (tenant_id, receipt_no)
);

-- ─── Receipt Allocations ─────────────────────────────────────────────────────
-- Links a payment/receipt to specific invoices
CREATE TABLE receipt_allocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  receipt_id        UUID NOT NULL REFERENCES payment_receipts(id) ON DELETE CASCADE,
  invoice_type      TEXT NOT NULL,   -- 'SALES_INVOICE' | 'PURCHASE_INVOICE'
  invoice_id        UUID NOT NULL,
  allocated_amount  NUMERIC(18,2) NOT NULL CHECK (allocated_amount > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_receipts_tenant_date  ON payment_receipts(tenant_id, receipt_date DESC);
CREATE INDEX idx_receipts_party        ON payment_receipts(tenant_id, party_id);
CREATE INDEX idx_receipts_status       ON payment_receipts(tenant_id, status);
CREATE INDEX idx_allocations_receipt   ON receipt_allocations(receipt_id);
CREATE INDEX idx_allocations_invoice   ON receipt_allocations(tenant_id, invoice_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_receipts_updated_at
    BEFORE UPDATE ON payment_receipts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE payment_receipts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_receipts" ON payment_receipts
  USING (tenant_id = (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "tenant_allocations" ON receipt_allocations
  USING (tenant_id = (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1));

-- ─── RPC: Post a Payment Receipt ─────────────────────────────────────────────
-- Creates a JV (DR bank/cash, CR debtor for RECEIPT; DR creditor, CR bank for PAYMENT)
-- then marks receipt as POSTED.
CREATE OR REPLACE FUNCTION rpc_post_payment_receipt(
  p_tenant_id       UUID,
  p_receipt_id      UUID,
  p_user_id         UUID,
  p_debit_account   UUID,   -- Bank/Cash account (RECEIPT) or Creditor (PAYMENT)
  p_credit_account  UUID    -- Debtor account (RECEIPT) or Bank/Cash (PAYMENT)
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_receipt   payment_receipts%ROWTYPE;
  v_jv_id     UUID;
  v_voucher_no TEXT;
BEGIN
  SELECT * INTO v_receipt
  FROM payment_receipts
  WHERE id = p_receipt_id AND tenant_id = p_tenant_id AND status = 'DRAFT';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found or not in DRAFT status';
  END IF;

  -- Generate voucher number
  v_voucher_no := CASE v_receipt.receipt_type
    WHEN 'RECEIPT' THEN 'RV-' || TO_CHAR(v_receipt.receipt_date, 'YYYY') || '-' || LPAD(NEXTVAL('receipt_jv_seq')::TEXT, 5, '0')
    ELSE                 'PV-' || TO_CHAR(v_receipt.receipt_date, 'YYYY') || '-' || LPAD(NEXTVAL('receipt_jv_seq')::TEXT, 5, '0')
  END;

  -- Create JV header
  INSERT INTO journal_vouchers (
    tenant_id, organisation_id, branch_id,
    voucher_no, voucher_date,
    voucher_type, reference_type, reference_id,
    narration, status, total_debit, total_credit,
    posted_at, posted_by, created_by, updated_by
  ) VALUES (
    p_tenant_id, v_receipt.organisation_id, v_receipt.branch_id,
    v_voucher_no, v_receipt.receipt_date,
    CASE v_receipt.receipt_type WHEN 'RECEIPT' THEN 'RECEIPT'::voucher_type_enum ELSE 'PAYMENT'::voucher_type_enum END,
    'PAYMENT_RECEIPT', p_receipt_id,
    COALESCE(v_receipt.narration, ''), 'POSTED', v_receipt.amount, v_receipt.amount,
    NOW(), p_user_id, p_user_id, p_user_id
  ) RETURNING id INTO v_jv_id;

  -- Create 2 JV lines (debit + credit)
  INSERT INTO journal_voucher_lines
    (tenant_id, voucher_id, line_no, account_id, party_id, debit_amount, credit_amount, narration)
  VALUES
    (p_tenant_id, v_jv_id, 1, p_debit_account,  v_receipt.party_id, v_receipt.amount, 0, v_receipt.narration),
    (p_tenant_id, v_jv_id, 2, p_credit_account, v_receipt.party_id, 0, v_receipt.amount, v_receipt.narration);

  -- Mark receipt as posted
  UPDATE payment_receipts SET
    status             = 'POSTED',
    journal_voucher_id = v_jv_id,
    updated_by         = p_user_id
  WHERE id = p_receipt_id AND tenant_id = p_tenant_id;

  RETURN v_jv_id;
END;
$$;

-- Sequence for receipt JV numbers
CREATE SEQUENCE IF NOT EXISTS receipt_jv_seq START 1;

-- ─── View: Trial Balance ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_trial_balance AS
SELECT
  a.id                    AS account_id,
  a.tenant_id,
  a.account_code,
  a.account_name,
  a.account_type,
  a.account_group,
  a.opening_balance,
  a.opening_balance_type,
  COALESCE(SUM(l.debit_amount),  0) AS period_debit,
  COALESCE(SUM(l.credit_amount), 0) AS period_credit
FROM chart_of_accounts a
LEFT JOIN journal_voucher_lines l ON l.account_id = a.id
LEFT JOIN journal_vouchers v ON v.id = l.voucher_id AND v.status = 'POSTED'
  AND v.tenant_id = a.tenant_id
WHERE a.is_active = TRUE
GROUP BY a.id, a.tenant_id, a.account_code, a.account_name,
         a.account_type, a.account_group, a.opening_balance, a.opening_balance_type;
