-- TaxIntel Phase 2/3 migration
-- Run this after the base schema is already installed.
-- It is non-destructive: it adds columns/indexes only.

ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS advisor_id UUID,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_row_number INTEGER,
  ADD COLUMN IF NOT EXISTS row_hash TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS duplicate_of_transaction_id UUID REFERENCES public.transactions(id),
  ADD COLUMN IF NOT EXISTS raw_data JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tax_risk_flags
  ADD COLUMN IF NOT EXISTS detection_method TEXT,
  ADD COLUMN IF NOT EXISTS legal_reference TEXT,
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.optional_rules_config
  ADD COLUMN IF NOT EXISTS rule_type TEXT DEFAULT 'heuristic',
  ADD COLUMN IF NOT EXISTS legal_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_upload ON public.transactions(upload_id);
CREATE INDEX IF NOT EXISTS idx_transactions_row_hash ON public.transactions(company_id, row_hash);
CREATE INDEX IF NOT EXISTS idx_tax_risk_flags_rule ON public.tax_risk_flags(rule_code);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.uploads(status);

UPDATE public.uploads
SET
  total_rows = COALESCE(total_rows, row_count, 0),
  valid_rows = COALESCE(valid_rows, row_count, 0),
  failed_rows = COALESCE(failed_rows, 0),
  duplicate_rows = COALESCE(duplicate_rows, 0),
  error_summary = COALESCE(error_summary, '[]'::jsonb)
WHERE total_rows IS NULL OR valid_rows IS NULL OR error_summary IS NULL;

UPDATE public.transactions
SET validation_status = COALESCE(validation_status, 'valid'),
    raw_data = COALESCE(raw_data, '{}'::jsonb)
WHERE validation_status IS NULL OR raw_data IS NULL;

UPDATE public.tax_risk_flags
SET evidence = COALESCE(evidence, '{}'::jsonb)
WHERE evidence IS NULL;
