-- TaxIntel Platform — Supabase Schema (v2)
-- Run this in Supabase SQL Editor → New Query → Paste → Run
-- Auth is handled by Supabase built-in Auth (auth.users) — no password columns needed.
-- Profiles table is optional supplementary data; run ONLY the tables you haven't yet created.

-- ──────────────────────────────────────────
-- STEP 1: Drop & recreate profiles (if already created with old shape)
-- ──────────────────────────────────────────
DROP TABLE IF EXISTS public.optional_rules_config CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.tax_risk_flags CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.uploads CASCADE;
DROP TABLE IF EXISTS public.company_users CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ──────────────────────────────────────────
-- Profiles (optional extra data — auth is handled by Supabase Auth)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'advisor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Companies (clients managed by advisors)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  tin_or_tax_id TEXT,
  industry TEXT,
  country TEXT DEFAULT 'Uganda',
  financial_year TEXT,
  risk_level TEXT DEFAULT 'low',
  risk_score NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  open_flags_count INTEGER DEFAULT 0,
  estimated_exposure NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Company <-> User assignments (user_id = Supabase Auth UUID)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,   -- references auth.users(id) — FK not enforced to allow flexibility
  role TEXT NOT NULL DEFAULT 'member',
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- ──────────────────────────────────────────
-- CSV uploads
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT,
  row_count INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Transactions
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES public.uploads(id),
  transaction_date TEXT,
  description TEXT,
  reference TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'UGX',
  account_code TEXT,
  account_category TEXT,
  vendor_name TEXT,
  customer_name TEXT,
  tax_type TEXT,
  vat_amount NUMERIC,
  withholding_tax_amount NUMERIC,
  transaction_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Tax risk flags (Uganda URA rules: VAT 18%, WHT 15%, PAYE 30%)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tax_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id),
  rule_code TEXT,
  risk_type TEXT,
  description TEXT,
  severity TEXT,
  estimated_exposure NUMERIC,
  status TEXT DEFAULT 'open',
  category TEXT,
  confidence TEXT,
  risk_score NUMERIC,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  review_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Advisory reports
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT,
  period_start TEXT,
  period_end TEXT,
  status TEXT DEFAULT 'draft',
  risk_score NUMERIC,
  risk_level TEXT,
  total_exposure NUMERIC,
  transaction_count INTEGER,
  high_risks INTEGER,
  medium_risks INTEGER,
  low_risks INTEGER,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Optional tax rules configuration
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.optional_rules_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  category TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  threshold NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Indexes for performance
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_company ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tax_risk_flags_company ON public.tax_risk_flags(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_risk_flags_status ON public.tax_risk_flags(status);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON public.company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON public.company_users(user_id);

-- ──────────────────────────────────────────
-- RLS: disable for service role key access (API server uses service role)
-- ──────────────────────────────────────────
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_risk_flags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.optional_rules_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
