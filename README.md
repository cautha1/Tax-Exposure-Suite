# TaxIntel Platform

TaxIntel is a tax exposure intelligence platform for client onboarding, CSV transaction ingestion, Uganda tax risk detection, advisory workflow management, and report generation.

## Current Scope

- Phase 1: Core platform, authentication, Docker deployment, audit logging.
- Phase 2: Reliable transaction ingestion, validation, duplicate detection, import traceability.
- Phase 3: VAT, WHT, and PAYE rules engine with evidence and legal references.
- Phase 4: Advisor dashboard, risk lifecycle, client activity trail, admin client management.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind, TanStack Query.
- Backend: Node.js, Express, TypeScript.
- Database/Auth: Supabase.
- Runtime: Docker Compose or Node.js with pnpm.

## Required Environment Variables

Create `.env` in the project root:

```env
TAXINTEL_DB_URL=https://your-project.supabase.co
TAXINTEL_DB_KEY=your-supabase-service-role-key
TAXINTEL_CORS_ORIGIN=http://localhost:3001,http://localhost:3000
API_PORT=18080
WEB_PORT=3001

# Optional local seed/demo access
TAXINTEL_SEED_DEMO_USERS=true
TAXINTEL_DEMO_PASSWORD=demo1234demo
```

Use the Supabase **service role key** for `TAXINTEL_DB_KEY` on the API server only. Do not expose it in browser code.

## Supabase Setup

1. Open Supabase project.
2. Go to **SQL Editor**.
3. Run `supabase-schema.sql` for a fresh database.
4. Run `supabase-phase2-phase3-migration.sql` after the base schema, or whenever upgrading an older database.
5. Confirm readiness:

```text
http://localhost:3001/api/readiness
```

Expected:

```json
{
  "status": "ready",
  "migrationRequired": null
}
```

## Local Deployment with Docker

From the project root:

```powershell
docker compose up -d --build
```

Open:

```text
http://localhost:3001
```

Useful checks:

```powershell
docker compose ps
Invoke-WebRequest -UseBasicParsing http://localhost:3001/api/healthz
Invoke-RestMethod http://localhost:3001/api/readiness
```

Stop services:

```powershell
docker compose down
```

## Local Development without Docker

Install dependencies:

```powershell
corepack enable
corepack pnpm install
```

Build/typecheck:

```powershell
corepack pnpm run typecheck
corepack pnpm run build
```

Run API:

```powershell
corepack pnpm --filter @workspace/api-server run dev
```

Run frontend:

```powershell
corepack pnpm --filter @workspace/tax-platform run dev
```

Typical local URLs:

- Frontend: `http://localhost:3000` or Vite-assigned port.
- Docker frontend: `http://localhost:3001`.
- Docker API: `http://localhost:18080`.

## Deploying on Replit

Recommended Replit setup:

1. Import the GitHub repository into Replit.
2. Add secrets in Replit **Secrets**:
   - `TAXINTEL_DB_URL`
   - `TAXINTEL_DB_KEY`
   - `TAXINTEL_CORS_ORIGIN`
   - `TAXINTEL_SEED_DEMO_USERS`
   - `TAXINTEL_DEMO_PASSWORD`
3. Set `TAXINTEL_CORS_ORIGIN` to the Replit web URL.
4. Install dependencies:

```bash
corepack enable
corepack pnpm install
```

5. Build:

```bash
corepack pnpm run build
```

6. Run the API:

```bash
corepack pnpm --filter @workspace/api-server run start
```

7. For frontend hosting on Replit, either:
   - run Vite preview for review environments, or
   - serve the built frontend from `artifacts/tax-platform/dist/public` behind a static server/proxy.

Production Replit note: keep the API and web origins aligned with `TAXINTEL_CORS_ORIGIN`.

## Deploying with Docker on a Server

1. Install Docker and Docker Compose.
2. Clone the repository.
3. Create `.env`.
4. Run:

```bash
docker compose up -d --build
```

5. Put Nginx/Caddy/Apache in front of the app for HTTPS.
6. Point the domain to the web service.
7. Keep Supabase keys in environment variables, not in committed files.

Suggested production reverse proxy:

- Public web: `https://your-domain.com`
- API proxied under: `https://your-domain.com/api`
- Internal API container: `api:8080`
- Internal web container: `web:80`

## Deploying on XAMPP or WAMP

XAMPP/WAMP can serve the frontend build, but it cannot run the Node/Express API by itself. Use this setup only if Apache is required by the hosting environment.

Frontend build:

```powershell
corepack pnpm --filter @workspace/tax-platform run build
```

Copy this folder into Apache web root:

```text
artifacts/tax-platform/dist/public
```

Example destination:

```text
C:\xampp\htdocs\taxintel
```

API requirement:

- Run the API separately using Node.js, Docker, Replit, or a VPS.
- Configure frontend build with the correct API URL before building:

```env
VITE_API_BASE_URL=https://your-api-domain.com/api
```

Apache rewrite for SPA routing, placed in `htdocs/taxintel/.htaccess`:

```apache
RewriteEngine On
RewriteBase /taxintel/
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /taxintel/index.html [L]
```

WAMP follows the same approach: serve the built frontend from `www`, and host the API separately.

## Production Readiness Checklist

- Supabase schema applied.
- `supabase-phase2-phase3-migration.sql` applied.
- `/api/readiness` returns `ready`.
- Admin can log in.
- Admin can create, edit, suspend, activate, and delete clients.
- CSV import works for a selected client.
- Risk scan runs from dashboard.
- Reports can be generated from the Reports page.
- Service role key is stored only on the server.
- Demo seed users disabled unless intentionally needed.
- HTTPS configured for public deployment.

## Common Commands

```powershell
corepack pnpm run typecheck
docker compose up -d --build
docker compose ps
docker compose logs api --tail 150
docker compose logs web --tail 150
```

## Important URLs

- Local Docker app: `http://localhost:3001`
- Health: `http://localhost:3001/api/healthz`
- Readiness: `http://localhost:3001/api/readiness`
- Supabase SQL migration: `supabase-phase2-phase3-migration.sql`
