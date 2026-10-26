-- ============================================================================
-- Migration 029: Chart of Accounts + Journal Vouchers (Double-Entry Engine)
-- ============================================================================

-- ─── Account Types Enum ──────────────────────────────────────────────────────
CREATE TYPE account_type_enum AS ENUM (
  'ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'
);

CREATE TYPE account_balance_type AS ENUM ('DR', 'CR');

CREATE TYPE control_account_type AS ENUM (
  'DEBTOR', 'CREDITOR', 'BANK', 'CASH', 'STOCK', 'TAX'
);

CREATE TYPE voucher_type_enum AS ENUM (
  'JOURNAL', 'PAYMENT', 'RECEIPT', 'CONTRA',
  'PURCHASE', 'SALES', 'CREDIT_NOTE', 'DEBIT_NOTE'
);

CREATE TYPE voucher_status_enum AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- ─── Chart of Accounts ───────────────────────────────────────────────────────
CREATE TABLE chart_of_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  organisation_id       UUID NOT NULL,
  branch_id             UUID,

  account_code          TEXT NOT NULL,
  account_name          TEXT NOT NULL,
  account_type          account_type_enum NOT NULL,
  account_group         TEXT NOT NULL DEFAULT '',   -- e.g. "Current Assets", "Direct Income"
  parent_account_id     UUID REFERENCES chart_of_accounts(id),

  -- Sub-ledger linking
  is_control_account    BOOLEAN NOT NULL DEFAULT FALSE,
  control_type          control_account_type,

  -- Opening balance (as of go-live date)
  opening_balance       NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_balance_type  account_balance_type NOT NULL DEFAULT 'DR',

  -- Flags
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  is_system             BOOLEAN NOT NULL DEFAULT FALSE,   -- system accounts cannot be deleted

  created_by            UUID,
  updated_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_account_code_tenant UNIQUE (tenant_id, account_code)
);

-- ─── Journal Vouchers ────────────────────────────────────────────────────────
CREATE TABLE journal_vouchers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  organisation_id   UUID NOT NULL,
  branch_id         UUID,

  voucher_no        TEXT NOT NULL,
  voucher_date      DATE NOT NULL,
  voucher_type      voucher_type_enum NOT NULL DEFAULT 'JOURNAL',

  -- Source document linkage
  reference_type    TEXT,    -- 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'CREDIT_NOTE' etc.
  reference_id      UUID,

  narration         TEXT NOT NULL DEFAULT '',
  status            voucher_status_enum NOT NULL DEFAULT 'DRAFT',

  -- Totals (computed at post time — must balance)
  total_debit       NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credit      NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- Posting
  posted_at         TIMESTAMPTZ,
  posted_by         UUID,

  created_by        UUID,
  updated_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_voucher_no_tenant UNIQUE (tenant_id, voucher_no),
  CONSTRAINT chk_posted_totals CHECK (
    status != 'POSTED' OR total_debit = total_credit
  )
);

-- ─── Journal Voucher Lines ───────────────────────────────────────────────────
CREATE TABLE journal_voucher_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  voucher_id    UUID NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
  line_no       INTEGER NOT NULL,

  account_id    UUID NOT NULL REFERENCES chart_of_accounts(id),
  party_id      UUID,           -- for AR/AP sub-ledger drill-down

  debit_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  narration     TEXT,
  cost_center   TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_one_side_nonzero CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0)
  )
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_coa_tenant         ON chart_of_accounts(tenant_id);
CREATE INDEX idx_coa_type           ON chart_of_accounts(tenant_id, account_type);
CREATE INDEX idx_jv_tenant_date     ON journal_vouchers(tenant_id, voucher_date DESC);
CREATE INDEX idx_jv_status          ON journal_vouchers(tenant_id, status);
CREATE INDEX idx_jv_reference       ON journal_vouchers(tenant_id, reference_type, reference_id);
CREATE INDEX idx_jvl_voucher        ON journal_voucher_lines(voucher_id);
CREATE INDEX idx_jvl_account        ON journal_voucher_lines(account_id);
CREATE INDEX idx_jvl_tenant_account ON journal_voucher_lines(tenant_id, account_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_coa_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_jv_updated_at
    BEFORE UPDATE ON journal_vouchers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE chart_of_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_vouchers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_voucher_lines ENABLE ROW LEVEL SECURITY;

-- chart_of_accounts
CREATE POLICY "tenant_coa" ON chart_of_accounts
  USING (tenant_id = (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1));

-- journal_vouchers
CREATE POLICY "tenant_jv" ON journal_vouchers
  USING (tenant_id = (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1));

-- journal_voucher_lines
CREATE POLICY "tenant_jvl" ON journal_voucher_lines
  USING (tenant_id = (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1));

-- ─── RPC: Post a Journal Voucher ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_post_journal_voucher(
  p_tenant_id   UUID,
  p_voucher_id  UUID,
  p_user_id     UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_debit   NUMERIC(18,2);
  v_credit  NUMERIC(18,2);
BEGIN
  -- Only DRAFT can be posted
  IF NOT EXISTS (
    SELECT 1 FROM journal_vouchers
    WHERE id = p_voucher_id AND tenant_id = p_tenant_id AND status = 'DRAFT'
  ) THEN
    RAISE EXCEPTION 'Voucher not found or not in DRAFT status';
  END IF;

  -- Compute totals from lines
  SELECT
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO v_debit, v_credit
  FROM journal_voucher_lines
  WHERE voucher_id = p_voucher_id AND tenant_id = p_tenant_id;

  -- Validate balance
  IF v_debit != v_credit OR v_debit = 0 THEN
    RAISE EXCEPTION 'Voucher does not balance: Debit=% Credit=%', v_debit, v_credit;
  END IF;

  -- Post
  UPDATE journal_vouchers SET
    status       = 'POSTED',
    total_debit  = v_debit,
    total_credit = v_credit,
    posted_at    = NOW(),
    posted_by    = p_user_id,
    updated_by   = p_user_id
  WHERE id = p_voucher_id AND tenant_id = p_tenant_id;
END;
$$;

-- ─── Seed: system accounts for a tenant (called after tenant creation) ────────
-- This is intentionally left as application-level seeding via server action
-- so each tenant gets their own account codes.
