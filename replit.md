# Tax Exposure Intelligence Platform

## Overview

A premium B2B SaaS platform for tax advisory firms, audit firms, and finance teams. Helps users identify tax exposure and compliance risks before an audit happens.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, Recharts, Framer Motion
- **API framework**: Express 5
- **Database**: Supabase (PostgreSQL via REST API over HTTPS using `@supabase/supabase-js`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: Email/password with bcryptjs, session stored in localStorage
- **CSV parsing**: PapaParse, react-dropzone

## Demo Accounts

- **Admin**: admin@taxintel.com / demo1234
- **Advisor**: advisor@taxintel.com / demo1234

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── tax-platform/       # React + Vite frontend (preview at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── ...
```

## Database Tables (Supabase: wqkcnnstnrhbttcnhvne)

- `profiles` — Users with email/password auth, roles (admin, advisor)
- `companies` — Client companies with risk scores, exposure estimates
- `uploads` — CSV file upload records
- `transactions` — Individual transaction rows from CSV uploads
- `tax_risk_flags` — Flagged tax compliance risks. **Live DB schema notes:**
  - `risk_type` has CHECK constraint that only allows `'VAT'` — code always sets `risk_type='VAT'` and uses `category` field for semantic type display
  - `issue_title` is NOT NULL — always provided from `RULE_TITLES` map
  - `confidence`, `reviewed_at`, `reviewed_by`, `review_notes`, `resolved_at`, `resolved_by`, `internal_note` columns do NOT exist in the live DB
  - Columns that DO exist: `id`, `company_id`, `transaction_id`, `rule_code`, `description`, `severity`, `estimated_exposure`, `status`, `category`, `risk_type`, `issue_title`, `risk_score`, `created_at`, `updated_at`
- `reports` — Generated tax exposure reports. Missing v2 columns: `risk_level`, `risk_score`, `period_start`, `period_end`, `transaction_count`

## Uganda Tax Rules (URA)

- VAT: 18% (standard rate)
- WHT (Withholding Tax): 15% on services, professional fees, contractor payments
- PAYE top marginal rate: 30%
- Rules engine: VAT-001/002/003, WHT-001/002/003, PAYE-001, EXP-001/002/003, REV-001/002

## Supabase Client Setup

- Must use `global: { headers: { Authorization: Bearer KEY } }` in `createClient()` to bypass RLS for writes
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Direct PostgreSQL connection is blocked from the Replit environment (only HTTPS to Supabase REST API works)

## API Routes

All routes at `/api`:

- `POST /api/auth/login` — authenticate user
- `POST /api/auth/signup` — create account
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — current user (x-user-id header)
- `GET/POST /api/companies` — list/create companies
- `GET/PUT /api/companies/:id` — get/update company
- `GET /api/companies/:id/summary` — analytics summary
- `GET /api/transactions` — list with pagination/search/filter
- `POST /api/transactions/upload` — bulk CSV import + auto risk flagging
- `GET /api/risks` — list tax risk flags
- `POST /api/risks/:id/resolve` — resolve a flag
- `GET/POST /api/reports` — list/generate reports
- `GET /api/reports/:id` — get report
- `GET /api/dashboard/stats` — stats cards data
- `GET /api/dashboard/charts` — chart data
- `GET /api/uploads` — list uploads

## Pages

- `/` — Premium landing page
- `/login` — Login with email/password
- `/signup` — Signup with role selector
- `/dashboard` — Analytics overview (protected)
- `/clients` — Client company list (protected)
- `/clients/:id` — Client detail with tabs (protected)
- `/transactions` — Transactions table (protected)
- `/transactions/upload` — CSV upload flow (protected)
- `/risks` — Tax risk flags table (protected)
- `/reports` — Reports list (protected)
- `/settings` — User settings (protected)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Run `pnpm run typecheck` from root.

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — full typecheck

## Development

- API server: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/tax-platform run dev`
- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
