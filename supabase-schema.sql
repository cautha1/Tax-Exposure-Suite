-- TaxIntel Platform — Supabase Schema
-- Run this once in your Supabase project: SQL Editor → New Query → Paste → Run

-- Profiles (users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  full_name TEXT,
  role TEXT DEFAULT 'advisor',
  company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Companies (clients)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  tin_or_tax_id TEXT,
  industry TEXT,
  country TEXT,
  financial_year TEXT,
  risk_level TEXT DEFAULT 'low',
  risk_score NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  open_flags_count INTEGER DEFAULT 0,
  estimated_exposure NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company <-> User assignments
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- CSV uploads
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT,
  row_count INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions
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

-- Tax risk flags
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

-- Advisory reports
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

-- Tax rules configuration
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

-- Seed demo users (password: demo1234)
INSERT INTO public.profiles (email, password_hash, full_name, role)
VALUES
  ('admin@taxintel.com', '$2b$10$hplVZ8L0qvl1ZFs/WF5CgOxBeLG/7G1QGVz/aARcsV8PP4qiH3RdS', 'Admin User', 'admin'),
  ('advisor@taxintel.com', '$2b$10$FLVMHFY7rYkokUlk3oieqOOSPWBgFiYTde5dD3cPKtyWpKFjEZrem', 'Tax Advisor', 'advisor')
ON CONFLICT (email) DO NOTHING;
