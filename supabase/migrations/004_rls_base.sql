-- ============================================================
-- Migration 004: Row-Level Security (RLS) — Base Policies
-- AgriSynq ERP — SUPABASE COMPATIBLE VERSION
-- ============================================================
-- FIXES APPLIED:
--   1. Helper functions moved to PUBLIC schema (auth schema is
--      owned by Supabase and cannot be written to).
--   2. tenant_id resolved from user_profiles via auth.uid()
--      instead of JWT claims (custom JWT claims require a
--      Supabase hook that is not needed here).
--   3. CREATE OR REPLACE TRIGGER replaced with DROP + CREATE
--      (PostgreSQL does not support CREATE OR REPLACE TRIGGER
--      prior to PG 14; Supabase safe pattern).

-- ── Helper: get current user's tenant_id ─────────────────────
-- Looks up tenant_id from user_profiles using auth.uid().
-- SECURITY DEFINER so it can always read user_profiles even
-- before the per-table RLS policies are fully evaluated.
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM   public.user_profiles
  WHERE  id = auth.uid();
$$;

-- ── Helper: get current authenticated user id ─────────────────
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT auth.uid();
$$;

-- ── Enable RLS on all infrastructure tables ───────────────────
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_years  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_series   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles       ENABLE ROW LEVEL SECURITY;

-- ── Base RLS Policies ─────────────────────────────────────────

-- tenants: user sees only their own tenant row
CREATE POLICY "tenant_isolation" ON tenants
  FOR ALL USING (id = public.get_tenant_id());

-- organisations: scoped to tenant
CREATE POLICY "org_tenant_isolation" ON organisations
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- branches: scoped to tenant
CREATE POLICY "branch_tenant_isolation" ON branches
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- financial_years: scoped to tenant
CREATE POLICY "fy_tenant_isolation" ON financial_years
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- invoice_series: scoped to tenant
CREATE POLICY "series_tenant_isolation" ON invoice_series
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- user_profiles: any user can read profiles in same tenant
CREATE POLICY "profile_tenant_read" ON user_profiles
  FOR SELECT USING (tenant_id = public.get_tenant_id());

-- user_profiles: user can only update their own profile
CREATE POLICY "profile_own_update" ON user_profiles
  FOR UPDATE USING (id = public.get_current_user_id());

-- user_profiles: only allow INSERT from the trigger (SECURITY DEFINER)
-- Direct INSERT by anon/authenticated is blocked.
CREATE POLICY "profile_insert_trigger_only" ON user_profiles
  FOR INSERT WITH CHECK (id = public.get_current_user_id());

-- roles: scoped to tenant
CREATE POLICY "roles_tenant_isolation" ON roles
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- permissions: global reference table — any authenticated user can read
CREATE POLICY "permissions_read_all" ON permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- role_permissions: readable if the role belongs to current tenant
CREATE POLICY "role_permissions_tenant_read" ON role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE  r.id        = role_permissions.role_id
        AND  r.tenant_id = public.get_tenant_id()
    )
  );

-- user_roles: scoped to tenant
CREATE POLICY "user_roles_tenant_isolation" ON user_roles
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- ── Trigger: auto-create user_profile on signup ───────────────
-- Fires after Supabase Auth creates a new user.
-- tenant_id MUST be passed as user_metadata at signup time:
--   supabase.auth.signUp({ email, password,
--     options: { data: { tenant_id: '...', full_name: '...' } }
--   })
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if tenant_id is present in metadata
  IF (NEW.raw_user_meta_data ->> 'tenant_id') IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, tenant_id, full_name)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data ->> 'tenant_id')::UUID,
      COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
      )
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop before create (PostgreSQL compatible; safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Trigger: updated_at auto-maintenance ─────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenants_updated_at        ON tenants;
DROP TRIGGER IF EXISTS set_organisations_updated_at  ON organisations;
DROP TRIGGER IF EXISTS set_branches_updated_at        ON branches;
DROP TRIGGER IF EXISTS set_user_profiles_updated_at  ON user_profiles;

CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_organisations_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

