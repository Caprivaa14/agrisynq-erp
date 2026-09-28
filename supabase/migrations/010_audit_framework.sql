-- ============================================================
-- Migration 010: Audit Framework
--   - audit_logs (immutable append-only)
--   - approvals (maker-checker workflow)
--   - period_locks (financial/GST/FMS/bank/stock)
--   - updated_at triggers for new tables
-- FertiLedger ERP
-- ============================================================

-- ── audit_logs ────────────────────────────────────────────────
-- IMMUTABLE: Never UPDATE or DELETE rows from this table.
-- Only the postgres/service role can insert (via SECURITY DEFINER trigger).
-- All authenticated users with audit_log:read permission can SELECT.
CREATE TABLE audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  organisation_id UUID        REFERENCES organisations(id),
  branch_id       UUID        REFERENCES branches(id),
  -- Who did it
  user_id         UUID        REFERENCES auth.users(id),
  user_email      TEXT,                          -- captured at log time (denormalised)
  user_role       TEXT,                          -- captured at log time
  -- What happened
  action          TEXT        NOT NULL,          -- e.g., 'INSERT', 'UPDATE', 'POST', 'APPROVE'
  table_name      TEXT        NOT NULL,
  record_id       UUID,
  -- Change detail
  old_values      JSONB,
  new_values      JSONB,
  changed_fields  TEXT[],                        -- list of field names that changed
  -- Context
  reason          TEXT,                          -- required for sensitive overrides
  source          TEXT DEFAULT 'app',            -- 'app' | 'migration' | 'trigger'
  ip_address      INET,                          -- nullable — where legally appropriate
  session_id      TEXT,
  -- Immutable timestamp
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce append-only: deny UPDATE and DELETE at policy level
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user in the same tenant can read (subject to permission check in app)
CREATE POLICY "audit_logs_tenant_select" ON audit_logs
  FOR SELECT USING (tenant_id = public.get_tenant_id());

-- Only SECURITY DEFINER functions can insert (application trigger)
CREATE POLICY "audit_logs_insert_trigger" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- Block UPDATE and DELETE at RLS level — immutable
CREATE POLICY "audit_logs_no_update" ON audit_logs
  FOR UPDATE USING (FALSE);

CREATE POLICY "audit_logs_no_delete" ON audit_logs
  FOR DELETE USING (FALSE);

-- Performance indexes
CREATE INDEX idx_audit_tenant     ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_record     ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_user       ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action     ON audit_logs(action, created_at DESC);

-- ── approvals ─────────────────────────────────────────────────
-- Maker-checker approval workflow for sensitive operations.
-- Created by the requesting user; updated by the approver.
CREATE TYPE approval_type_enum AS ENUM (
  'RATE_BELOW_MINIMUM',
  'CREDIT_LIMIT_OVERRIDE',
  'LICENCE_OVERRIDE',
  'NEGATIVE_STOCK_OVERRIDE',
  'BACKDATED_ENTRY',
  'TAX_OVERRIDE',
  'THIRD_PARTY_PAYMENT',
  'SETTLEMENT_INSTRUMENT',
  'SALES_RETURN',
  'FRESH_REINVOICE',
  'STOCK_ADJUSTMENT',
  'DAMAGE_WRITEOFF',
  'EXPIRY_WRITEOFF',
  'PERIOD_REOPEN',
  'SENSITIVE_KYC_VIEW',
  'SENSITIVE_KYC_EXPORT',
  'PURCHASE_RATE_VARIANCE',
  'CREDIT_NOTE_ISSUE',
  'RETURN_WITHOUT_EVIDENCE',
  'LARGE_PAYMENT'
);

CREATE TYPE approval_status_enum AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'RECALLED'
);

CREATE TABLE approvals (
  id                    UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID                NOT NULL REFERENCES tenants(id),
  organisation_id       UUID                REFERENCES organisations(id),
  branch_id             UUID                REFERENCES branches(id),
  -- Approval type and linked document
  approval_type         approval_type_enum  NOT NULL,
  source_document_type  TEXT,              -- e.g., 'sales_invoice', 'stock_adjustment'
  source_document_id    UUID,
  -- Request
  requested_by          UUID                NOT NULL REFERENCES auth.users(id),
  requested_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  required_role         TEXT,              -- role name required to approve
  request_notes         TEXT,
  -- Approval / rejection
  approver_id           UUID                REFERENCES auth.users(id),
  approved_at           TIMESTAMPTZ,
  approver_notes        TEXT,
  -- Expiry (auto-expire pending approvals)
  expires_at            TIMESTAMPTZ,
  -- Status
  status                approval_status_enum NOT NULL DEFAULT 'PENDING',
  -- Audit
  created_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approvals_tenant_select" ON approvals
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "approvals_tenant_insert" ON approvals
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "approvals_tenant_update" ON approvals
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "approvals_no_delete" ON approvals
  FOR DELETE USING (FALSE);

CREATE INDEX idx_approvals_tenant   ON approvals(tenant_id, status, created_at DESC);
CREATE INDEX idx_approvals_document ON approvals(source_document_type, source_document_id);
CREATE INDEX idx_approvals_requester ON approvals(requested_by, created_at DESC);

DROP TRIGGER IF EXISTS set_approvals_updated_at ON approvals;
CREATE TRIGGER set_approvals_updated_at
  BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── period_locks ──────────────────────────────────────────────
-- Controls which financial/GST/FMS/bank periods are locked.
-- Locked periods prevent new postings into that period.
CREATE TYPE period_lock_type_enum AS ENUM (
  'FINANCIAL',    -- General ledger period lock
  'GST',          -- GST period lock (no new invoices in that GSTR period)
  'FMS',          -- FMS claim period lock
  'BANK',         -- Bank reconciliation period lock
  'STOCK'         -- Stock closing period lock
);

CREATE TABLE period_locks (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID                    NOT NULL REFERENCES tenants(id),
  organisation_id UUID                    NOT NULL REFERENCES organisations(id),
  branch_id       UUID                    REFERENCES branches(id),  -- null = all branches
  lock_type       period_lock_type_enum   NOT NULL,
  period_from     DATE                    NOT NULL,
  period_to       DATE                    NOT NULL,
  is_locked       BOOLEAN                 NOT NULL DEFAULT TRUE,
  -- Lock metadata
  locked_by       UUID                    REFERENCES auth.users(id),
  locked_at       TIMESTAMPTZ,
  lock_reason     TEXT,
  -- Unlock metadata (if unlocked)
  unlocked_by     UUID                    REFERENCES auth.users(id),
  unlocked_at     TIMESTAMPTZ,
  unlock_reason   TEXT,
  -- Audit
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_period CHECK (period_to >= period_from)
);

ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "period_locks_tenant_select" ON period_locks
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "period_locks_tenant_insert" ON period_locks
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "period_locks_tenant_update" ON period_locks
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Period locks are never deleted — only unlocked (is_locked = false)
CREATE POLICY "period_locks_no_delete" ON period_locks
  FOR DELETE USING (FALSE);

CREATE INDEX idx_period_locks_tenant ON period_locks(tenant_id, organisation_id, lock_type, period_from);

DROP TRIGGER IF EXISTS set_period_locks_updated_at ON period_locks;
CREATE TRIGGER set_period_locks_updated_at
  BEFORE UPDATE ON period_locks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── DB helper: is_period_locked() ─────────────────────────────
-- Call this in posting functions to check if a date falls in a locked period.
-- Returns TRUE if the given date is within a locked period for the given type.
CREATE OR REPLACE FUNCTION public.is_period_locked(
  p_tenant_id       UUID,
  p_organisation_id UUID,
  p_branch_id       UUID,       -- pass NULL to check org-wide locks
  p_lock_type       period_lock_type_enum,
  p_date            DATE
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.period_locks
    WHERE  tenant_id       = p_tenant_id
      AND  organisation_id = p_organisation_id
      AND  lock_type       = p_lock_type
      AND  is_locked       = TRUE
      AND  p_date BETWEEN period_from AND period_to
      AND  (branch_id IS NULL OR branch_id = p_branch_id)
  );
$$;
