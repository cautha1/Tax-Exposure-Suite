-- Tax Exposure Intelligence Platform - Supabase Migration
-- Run this in your Supabase SQL Editor at: https://supabase.com/dashboard/project/wqkcnnstnrhbttcnhvne/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (users with custom auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'advisor',
  password_hash TEXT NOT NULL,
  company_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  tin_or_tax_id TEXT,
  industry TEXT,
  country TEXT,
  financial_year TEXT,
  risk_level TEXT,
  risk_score NUMERIC,
  transaction_count INTEGER DEFAULT 0,
  open_flags_count INTEGER DEFAULT 0,
  estimated_exposure NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Uploads table
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name TEXT,
  row_count INTEGER,
  status TEXT DEFAULT 'completed',
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id),
  transaction_date TEXT,
  description TEXT,
  reference TEXT,
  amount NUMERIC,
  currency TEXT,
  account_code TEXT,
  account_category TEXT,
  vendor_name TEXT,
  customer_name TEXT,
  tax_type TEXT,
  vat_amount NUMERIC,
  withholding_tax_amount NUMERIC,
  transaction_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Tax risk flags table
CREATE TABLE IF NOT EXISTS tax_risk_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id),
  rule_code TEXT,
  description TEXT,
  severity TEXT,
  estimated_exposure NUMERIC,
  status TEXT DEFAULT 'open',
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT,
  status TEXT DEFAULT 'ready',
  summary TEXT,
  total_exposure NUMERIC,
  high_risks INTEGER DEFAULT 0,
  medium_risks INTEGER DEFAULT 0,
  low_risks INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Disable Row Level Security (for service role access via API)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_risk_flags DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;

-- Seed demo companies
INSERT INTO companies (id, company_name, tin_or_tax_id, industry, country, financial_year, risk_level, risk_score, transaction_count, open_flags_count, estimated_exposure)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Meridian Holdings Ltd', 'TIN-001-2024', 'Financial Services', 'United States', '2024', 'high', 72, 1450, 8, 125000),
  ('22222222-2222-2222-2222-222222222222', 'Apex Manufacturing Group', 'TIN-002-2024', 'Manufacturing', 'United Kingdom', '2024', 'medium', 45, 980, 4, 48500),
  ('33333333-3333-3333-3333-333333333333', 'SkyTech Solutions Inc', 'TIN-003-2024', 'Technology', 'Canada', '2024', 'low', 18, 620, 1, 12000),
  ('44444444-4444-4444-4444-444444444444', 'Global Trade Partners', 'TIN-004-2024', 'Import/Export', 'Australia', '2024', 'high', 85, 2100, 12, 290000),
  ('55555555-5555-5555-5555-555555555555', 'Coastal Properties LLC', 'TIN-005-2024', 'Real Estate', 'United States', '2024', 'medium', 38, 340, 3, 35000)
ON CONFLICT (id) DO NOTHING;

-- Seed transactions
INSERT INTO transactions (company_id, transaction_date, description, reference, amount, currency, account_code, account_category, vendor_name, tax_type, vat_amount, withholding_tax_amount, transaction_type)
VALUES
  ('11111111-1111-1111-1111-111111111111', '2024-01-15', 'Consulting services payment', 'REF-001', 45000, 'USD', 'ACC-600', 'Professional Services', 'McKinsey & Co', 'VAT', 3375, 0, 'expense'),
  ('11111111-1111-1111-1111-111111111111', '2024-02-10', 'Software licensing fee', 'REF-002', 12500, 'USD', 'ACC-700', 'Technology', 'Microsoft Corp', 'VAT', 937.5, 0, 'expense'),
  ('11111111-1111-1111-1111-111111111111', '2024-02-28', 'Office lease payment', 'REF-003', 8200, 'USD', 'ACC-500', 'Rent', 'Property Trust LLC', 'WHT', 0, 410, 'expense'),
  ('22222222-2222-2222-2222-222222222222', '2024-01-20', 'Raw materials purchase', 'REF-101', 78000, 'GBP', 'ACC-200', 'Inventory', 'Steel Corp UK', 'VAT', 15600, 0, 'expense'),
  ('22222222-2222-2222-2222-222222222222', '2024-03-05', 'Equipment maintenance', 'REF-102', 22000, 'GBP', 'ACC-400', 'Maintenance', 'TechFix Ltd', 'VAT', 4400, 0, 'expense'),
  ('33333333-3333-3333-3333-333333333333', '2024-02-14', 'Cloud infrastructure', 'REF-201', 9800, 'CAD', 'ACC-700', 'Technology', 'AWS Canada', 'GST', 490, 0, 'expense'),
  ('44444444-4444-4444-4444-444444444444', '2024-01-08', 'Import duties payment', 'REF-301', 156000, 'AUD', 'ACC-300', 'Customs', 'AUS Customs', 'GST', 0, 0, 'expense'),
  ('44444444-4444-4444-4444-444444444444', '2024-02-22', 'Freight services', 'REF-302', 45000, 'AUD', 'ACC-400', 'Logistics', 'FastShip Pty Ltd', 'GST', 4500, 0, 'expense'),
  ('55555555-5555-5555-5555-555555555555', '2024-01-30', 'Property maintenance', 'REF-401', 18500, 'USD', 'ACC-400', 'Maintenance', 'BuildRight LLC', 'VAT', 0, 925, 'expense'),
  ('55555555-5555-5555-5555-555555555555', '2024-03-12', 'Insurance premium', 'REF-402', 32000, 'USD', 'ACC-800', 'Insurance', 'SafeGuard Insurance', 'VAT', 0, 0, 'expense');

-- Seed tax risk flags
INSERT INTO tax_risk_flags (company_id, rule_code, description, severity, estimated_exposure, status, category)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'VAT-001', 'Zero VAT on consulting services - potential misclassification', 'high', 45000, 'open', 'VAT'),
  ('11111111-1111-1111-1111-111111111111', 'WHT-001', 'Missing withholding tax on lease payment to foreign entity', 'high', 32000, 'open', 'Withholding Tax'),
  ('11111111-1111-1111-1111-111111111111', 'CIT-001', 'Related party transactions without transfer pricing documentation', 'medium', 28000, 'open', 'Corporate Tax'),
  ('11111111-1111-1111-1111-111111111111', 'VAT-003', 'Input VAT claimed on non-deductible entertainment expenses', 'medium', 8500, 'open', 'VAT'),
  ('22222222-2222-2222-2222-222222222222', 'VAT-002', 'VAT on imported goods - customs valuation mismatch', 'medium', 18500, 'open', 'VAT'),
  ('22222222-2222-2222-2222-222222222222', 'CIT-002', 'Depreciation rate applied exceeds statutory limit', 'low', 12000, 'open', 'Corporate Tax'),
  ('22222222-2222-2222-2222-222222222222', 'VAT-004', 'Exempt supply incorrectly treated as taxable', 'medium', 18000, 'open', 'VAT'),
  ('33333333-3333-3333-3333-333333333333', 'VAT-005', 'Cross-border digital services VAT registration required', 'low', 12000, 'open', 'VAT'),
  ('44444444-4444-4444-4444-444444444444', 'GST-001', 'GST not applied on imported services from overseas supplier', 'high', 95000, 'open', 'GST'),
  ('44444444-4444-4444-4444-444444444444', 'GST-002', 'GST credit claimed on non-business use assets', 'high', 48000, 'open', 'GST'),
  ('44444444-4444-4444-4444-444444444444', 'WHT-003', 'Interest payments to foreign lender - WHT not withheld', 'high', 67000, 'open', 'Withholding Tax'),
  ('44444444-4444-4444-4444-444444444444', 'CIT-003', 'Thin capitalisation rules breach - excess interest deductions', 'medium', 42000, 'open', 'Corporate Tax'),
  ('55555555-5555-5555-5555-555555555555', 'VAT-001', 'Zero VAT on property management services', 'medium', 18500, 'open', 'VAT'),
  ('55555555-5555-5555-5555-555555555555', 'WHT-001', 'Missing withholding on contractor payments', 'low', 9500, 'open', 'Withholding Tax');

-- Seed uploads
INSERT INTO uploads (company_id, file_name, row_count, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'meridian_q1_2024.csv', 450, 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'meridian_q2_2024.csv', 380, 'completed'),
  ('22222222-2222-2222-2222-222222222222', 'apex_fy2024_transactions.csv', 980, 'completed'),
  ('44444444-4444-4444-4444-444444444444', 'global_trade_jan_mar.csv', 1100, 'completed'),
  ('55555555-5555-5555-5555-555555555555', 'coastal_annual.csv', 340, 'completed');

-- Seed reports
INSERT INTO reports (company_id, title, status, summary, total_exposure, high_risks, medium_risks, low_risks)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tax Exposure Report - Meridian Holdings Ltd - Q1 2024', 'ready', 'Analysis identified 4 open tax risk flags with estimated total exposure of $113,500. High: 2, Medium: 2, Low: 0.', 113500, 2, 2, 0),
  ('44444444-4444-4444-4444-444444444444', 'Tax Exposure Report - Global Trade Partners - FY2024', 'ready', 'Analysis identified 5 open tax risk flags with estimated total exposure of $252,000. High: 3, Medium: 2, Low: 0.', 252000, 3, 2, 0);

-- Seed demo user accounts (password is "demo1234" for both)
INSERT INTO profiles (id, email, full_name, role, password_hash, company_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@taxintel.com', 'Alex Chen', 'admin', '$2b$10$nj2PCrNq8mmzfecfh7tXL.kJg3iecim8vWFEAtpg2ml0DM.CiCSBC', null),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'advisor@taxintel.com', 'Sarah Williams', 'advisor', '$2b$10$4A16atz/.vrGHsjrs0a0DuEjx96KDFFLlhZikwgAaQYrWre8b5fNG', null)
ON CONFLICT (email) DO NOTHING;
