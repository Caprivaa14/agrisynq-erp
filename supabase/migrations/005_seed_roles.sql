-- ============================================================
-- Migration 005: Seed System Roles & Permissions
-- AgriSynq ERP
-- ============================================================
-- This seeds the permissions reference table and creates
-- system role templates. Actual tenant roles are created
-- when a new tenant is onboarded.

-- ── Seed: permissions ─────────────────────────────────────────
INSERT INTO permissions (module, action, description) VALUES
  -- Master Data
  ('master_data',       'create',  'Create parties, products, locations, licences'),
  ('master_data',       'read',    'View master data'),
  ('master_data',       'update',  'Edit master data'),
  ('master_data',       'delete',  'Soft-delete master data'),
  -- Farmer KYC (sensitive — restricted)
  ('farmer_kyc',        'read',    'View farmer records'),
  ('farmer_kyc',        'create',  'Create farmer records'),
  ('farmer_kyc',        'update',  'Update farmer records'),
  ('farmer_kyc_sensitive','read',  'View unmasked Aadhaar/PAN — restricted role only'),
  -- Purchases
  ('purchases',         'create',  'Create purchase orders and GRNs'),
  ('purchases',         'read',    'View purchase documents'),
  ('purchases',         'approve', 'Approve GRNs and purchase invoices'),
  ('purchases',         'post',    'Post purchase invoices to ledger'),
  -- Sales
  ('sales',             'create',  'Create quotations, sales orders, invoices'),
  ('sales',             'read',    'View sales documents'),
  ('sales',             'approve', 'Approve sales orders'),
  ('sales',             'post',    'Post invoices to ledger'),
  ('sales',             'cancel',  'Cancel posted documents'),
  -- Inventory
  ('inventory',         'read',    'View stock ledger and positions'),
  ('inventory',         'create',  'Create DCs, gate passes, transfers'),
  ('inventory',         'approve', 'Approve stock transfers and adjustments'),
  ('inventory',         'post',    'Post stock movements'),
  -- Batch management (special: provisional batch update)
  ('batch_management',  'update',  'Update provisional batches — restricted'),
  -- Accounting
  ('accounting',        'read',    'View vouchers, ledgers, trial balance'),
  ('accounting',        'create',  'Create receipts, payments, journal entries'),
  ('accounting',        'post',    'Post vouchers to ledger'),
  ('accounting',        'approve', 'Approve payments above threshold'),
  -- GST
  ('gst',               'read',    'View GST registers and reports'),
  ('gst',               'export',  'Export GST data for filing'),
  -- FMS Compliance
  ('fms',               'read',    'View FMS ledger and reconciliation'),
  ('fms',               'import',  'Import FMS/PoS data files'),
  ('fms',               'approve', 'Approve Cancel & Reissue requests'),
  -- Bank
  ('bank',              'read',    'View bank accounts and statements'),
  ('bank',              'import',  'Import bank statements'),
  ('bank',              'approve', 'Lock bank reconciliation periods'),
  -- Reports
  ('reports',           'read',    'View all reports'),
  ('reports',           'export',  'Export reports to PDF/Excel'),
  -- Administration
  ('admin_users',       'create',  'Create users'),
  ('admin_users',       'read',    'View users and roles'),
  ('admin_users',       'update',  'Edit user roles and access'),
  ('admin_periods',     'approve', 'Lock/unlock financial and GST periods'),
  ('audit_log',         'read',    'View audit log — restricted');

-- ── Helper: onboard_tenant() ──────────────────────────────────
-- Call this function when a new tenant is created.
-- Creates the 7 system roles for the tenant with appropriate permissions.
CREATE OR REPLACE FUNCTION public.onboard_tenant(
  p_tenant_id   UUID,
  p_tenant_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r_super     UUID;
  r_admin     UUID;
  r_account   UUID;
  r_sales     UUID;
  r_stock     UUID;
  r_fms       UUID;
  r_viewer    UUID;
BEGIN
  -- Create system roles
  INSERT INTO roles (tenant_id, name, description, is_system) VALUES
    (p_tenant_id, 'SUPER_ADMIN',      'Full system access across all modules', TRUE)
    RETURNING id INTO r_super;

  INSERT INTO roles (tenant_id, name, description, is_system) VALUES
    (p_tenant_id, 'BRANCH_ADMIN',     'Branch-level administration', TRUE)
    RETURNING id INTO r_admin;

  INSERT INTO roles (tenant_id, name, description, is_system) VALUES
    (p_tenant_id, 'ACCOUNTANT',       'Accounting, GST, and bank reconciliation', TRUE)
    RETURNING id INTO r_account;

  INSERT INTO roles (tenant_id, name, description, is_system) VALUES
    (p_tenant_id, 'SALES_MANAGER',    'Sales orders, invoices, and receipts', TRUE)
    RETURNING id INTO r_sales;

  INSERT INTO roles (tenant_id, name, description, is_system) VALUES
    (p_tenant_id, 'STOCK_MANAGER',    'Inventory, DCs, gate passes, and transfers', TRUE)
    RETURNING id INTO r_stock;

  INSERT INTO roles (tenant_id, name, description, is_system) VALUES
    (p_tenant_id, 'FMS_COMPLIANCE',   'FMS import, reconciliation, and reissue', TRUE)
    RETURNING id INTO r_fms;

  INSERT INTO roles (tenant_id, name, description, is_system) VALUES
    (p_tenant_id, 'VIEWER',           'Read-only access to all non-sensitive modules', TRUE)
    RETURNING id INTO r_viewer;

  -- SUPER_ADMIN: all permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r_super, id FROM permissions;

  -- ACCOUNTANT: accounting, GST, bank, reports, master_data read
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r_account, id FROM permissions
  WHERE module IN ('accounting','gst','bank','reports')
     OR (module = 'master_data'   AND action = 'read')
     OR (module = 'sales'         AND action = 'read')
     OR (module = 'purchases'     AND action = 'read')
     OR (module = 'inventory'     AND action = 'read');

  -- SALES_MANAGER: sales, master_data read, accounting read, inventory read
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r_sales, id FROM permissions
  WHERE module IN ('sales','farmer_kyc')
     OR (module = 'master_data' AND action IN ('read','create','update'))
     OR (module = 'accounting'  AND action IN ('read','create'))
     OR (module = 'inventory'   AND action = 'read');

  -- STOCK_MANAGER: inventory, purchases (GRN), master_data read
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r_stock, id FROM permissions
  WHERE module IN ('inventory','batch_management')
     OR (module = 'purchases'   AND action IN ('read','create','approve'))
     OR (module = 'master_data' AND action = 'read');

  -- FMS_COMPLIANCE: fms, farmer_kyc read, reports read
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r_fms, id FROM permissions
  WHERE module IN ('fms')
     OR (module = 'farmer_kyc' AND action = 'read')
     OR (module = 'reports'    AND action IN ('read','export'));

  -- VIEWER: read-only on everything except sensitive
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r_viewer, id FROM permissions
  WHERE action = 'read'
    AND module NOT IN ('farmer_kyc_sensitive','audit_log','admin_users');

END;
$$;

-- ── Example: Call onboard_tenant for your first tenant ───────
-- Run this manually AFTER creating your first tenant row:
--
-- SELECT public.onboard_tenant(
--   'YOUR-TENANT-UUID-HERE',
--   'Your Company Name'
-- );
