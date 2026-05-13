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
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by UUID,
  advisor_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
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
  source_row_number INTEGER,
  row_hash TEXT,
  validation_status TEXT DEFAULT 'valid',
  duplicate_of_transaction_id UUID REFERENCES public.transactions(id),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
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
  issue_title TEXT,
  risk_type TEXT,
  description TEXT,
  severity TEXT,
  estimated_exposure NUMERIC,
  status TEXT DEFAULT 'open',
  category TEXT,
  confidence TEXT,
  risk_score NUMERIC,
  detection_method TEXT,
  legal_reference TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
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
  created_by UUID,
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
  rule_type TEXT DEFAULT 'heuristic',
  legal_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_role TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Indexes for performance
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_company ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_upload ON public.transactions(upload_id);
CREATE INDEX IF NOT EXISTS idx_transactions_row_hash ON public.transactions(company_id, row_hash);
CREATE INDEX IF NOT EXISTS idx_tax_risk_flags_company ON public.tax_risk_flags(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_risk_flags_status ON public.tax_risk_flags(status);
CREATE INDEX IF NOT EXISTS idx_tax_risk_flags_rule ON public.tax_risk_flags(rule_code);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.uploads(status);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON public.company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

-- ──────────────────────────────────────────
-- RLS baseline for direct authenticated access. The API server still uses the
-- service role key for controlled backend operations.
-- ──────────────────────────────────────────
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optional_rules_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS company_users_self_select ON public.company_users;
CREATE POLICY company_users_self_select ON public.company_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS companies_assigned_select ON public.companies;
CREATE POLICY companies_assigned_select ON public.companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = companies.id
      AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS uploads_assigned_select ON public.uploads;
CREATE POLICY uploads_assigned_select ON public.uploads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = uploads.company_id
      AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transactions_assigned_select ON public.transactions;
CREATE POLICY transactions_assigned_select ON public.transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = transactions.company_id
      AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS risks_assigned_select ON public.tax_risk_flags;
CREATE POLICY risks_assigned_select ON public.tax_risk_flags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = tax_risk_flags.company_id
      AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reports_assigned_select ON public.reports;
CREATE POLICY reports_assigned_select ON public.reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = reports.company_id
      AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rules_global_or_assigned_select ON public.optional_rules_config;
CREATE POLICY rules_global_or_assigned_select ON public.optional_rules_config
  FOR SELECT TO authenticated
  USING (
    company_id IS NULL OR EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = optional_rules_config.company_id
      AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS activity_logs_assigned_select ON public.activity_logs;
CREATE POLICY activity_logs_assigned_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    actor_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = activity_logs.company_id
      AND cu.user_id = auth.uid()
    )
  );
