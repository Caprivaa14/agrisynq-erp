-- ============================================================
-- Migration 001: Enable required PostgreSQL extensions
-- AgriSynq ERP
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor
-- Or via: supabase db push

-- pgcrypto: for encrypting Aadhaar, PAN, account numbers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuid-ossp: for gen_random_uuid() (also available via pgcrypto)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: for fuzzy search on party names, product names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
