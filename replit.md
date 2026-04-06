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

## Database Tables

- `profiles` — Users with email/password auth, roles (admin, advisor, client_user)
- `companies` — Client companies with risk scores, exposure estimates
- `uploads` — CSV file upload records
- `transactions` — Individual transaction rows from CSV uploads
- `tax_risk_flags` — Flagged tax compliance risks with severity and exposure
- `reports` — Generated tax exposure reports

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
