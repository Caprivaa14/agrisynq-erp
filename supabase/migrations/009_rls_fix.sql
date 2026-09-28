-- ============================================================
-- Migration 009: Fix RLS — Replace USING (true) with
--                tenant-scoped policies on all master data tables
-- FertiLedger ERP
-- ============================================================
-- BLOCKER B-01 FIX: Migrations 006, 007, 008 used USING (true),
-- allowing any authenticated user across ALL tenants to read/write
-- each other's parties, products, farmers, locations, licences.
-- This migration drops those insecure policies and replaces them
-- with proper tenant_id-scoped RLS using get_tenant_id().
--
-- Safe to run: DROP POLICY IF EXISTS + CREATE POLICY
-- Run AFTER migrations 001–008.
-- ============================================================

-- ── Helper: get current user's branch_id ─────────────────────
-- Returns the first branch_id assigned to the current user.
-- Used for branch-scoped inserts/reads.
CREATE OR REPLACE FUNCTION public.get_branch_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id
  FROM   public.user_roles
  WHERE  user_id  = auth.uid()
    AND  branch_id IS NOT NULL
  LIMIT  1;
$$;

-- ── PARTIES ──────────────────────────────────────────────────
-- Drop insecure USING(true) policies
DROP POLICY IF EXISTS "Enable read access for authenticated users"   ON parties;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON parties;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON parties;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON parties;

-- Create tenant-scoped policies
CREATE POLICY "parties_tenant_select" ON parties
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "parties_tenant_insert" ON parties
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "parties_tenant_update" ON parties
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- No hard DELETE: use soft-archive (is_active=false) — policy blocks direct delete
-- Only SUPER_ADMIN can hard-delete (handled at application layer; DB blocks all)
CREATE POLICY "parties_no_delete" ON parties
  FOR DELETE USING (FALSE);

-- ── PRODUCTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable read access for authenticated users"   ON products;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON products;

CREATE POLICY "products_tenant_select" ON products
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "products_tenant_insert" ON products
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "products_tenant_update" ON products
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "products_no_delete" ON products
  FOR DELETE USING (FALSE);

-- ── FARMERS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable read access for authenticated users"   ON farmers;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON farmers;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON farmers;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON farmers;

CREATE POLICY "farmers_tenant_select" ON farmers
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "farmers_tenant_insert" ON farmers
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "farmers_tenant_update" ON farmers
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Farmer records must never be hard-deleted (statutory / audit requirement)
CREATE POLICY "farmers_no_delete" ON farmers
  FOR DELETE USING (FALSE);

-- ── LOCATIONS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable read access for authenticated users"   ON locations;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON locations;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON locations;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON locations;

CREATE POLICY "locations_tenant_select" ON locations
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "locations_tenant_insert" ON locations
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "locations_tenant_update" ON locations
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

CREATE POLICY "locations_no_delete" ON locations
  FOR DELETE USING (FALSE);

-- ── LICENCES ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable read access for authenticated users"   ON licences;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON licences;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON licences;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON licences;

CREATE POLICY "licences_tenant_select" ON licences
  FOR SELECT USING (tenant_id = public.get_tenant_id());

CREATE POLICY "licences_tenant_insert" ON licences
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "licences_tenant_update" ON licences
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Licences are statutory records — must not be hard-deleted
CREATE POLICY "licences_no_delete" ON licences
  FOR DELETE USING (FALSE);

-- ── Verify: confirm policies are applied ─────────────────────
-- Run this query in Supabase SQL editor after applying migration:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('parties','products','farmers','locations','licences')
-- ORDER BY tablename, policyname;
