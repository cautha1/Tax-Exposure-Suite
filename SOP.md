# TaxIntel Client Pitch SOP

This SOP guides the owner or presenter through a clean client/boss pitch for TaxIntel.

## 1. Purpose of the Pitch

Position TaxIntel as a practical advisory platform that helps tax teams:

- onboard clients,
- import transaction data,
- detect tax exposure,
- explain risk findings,
- manage review actions,
- generate advisory reports.

The pitch should feel like a working product walkthrough, not a technical demo.

## 2. Pre-Meeting Checklist

Complete this before the meeting:

- Confirm the app opens at `http://localhost:3001`.
- Confirm `/api/readiness` shows `status: ready`.
- Log in with the admin account.
- Confirm at least one client exists.
- Confirm dashboard loads without errors.
- Have one clean CSV file ready for upload.
- Keep Supabase dashboard closed unless asked technical questions.
- Keep browser zoom at 90-100%.
- Close unrelated browser tabs.

## 3. Suggested Opening Statement

Use this wording:

> TaxIntel is built to help advisory teams identify tax exposure earlier, explain risk findings clearly, and manage client review work from one platform. The first release focuses on client onboarding, transaction ingestion, Uganda tax rules, risk review, and advisory reporting.

Keep it short. Then move into the product.

## 4. Demo Flow

### Step 1: Dashboard

Open:

```text
http://localhost:3001/dashboard
```

Say:

> This dashboard gives the advisor a portfolio-level view of active clients, unresolved risks, estimated exposure, and recent advisory activity.

Show:

- Compliance Score
- Total Exposure
- Unresolved Risks
- Active Clients
- Risk Distribution Matrix
- Advisory Workflow

Avoid saying:

- "This is just a demo."
- "Some things are still mocked."
- "We can fix this later."

### Step 2: Client Management

Open **Clients**.

Say:

> Admin users can manage client workspaces from here. They can create clients, update profile details, suspend inactive client workspaces, and remove records when needed.

Show:

- Add Client
- Edit Client
- Suspend/Activate Client
- Delete Client only if appropriate

Do not delete an important client during the pitch.

### Step 3: Transaction Import

Open **Transactions > Import CSV**.

Say:

> The ingestion process validates incoming transaction data before it is accepted. It checks required fields, tracks import status, detects duplicates, and links the upload to the correct client and advisor context.

Show:

- Select client
- Upload CSV
- Preview rows
- Import result

If import produces warnings, frame it positively:

> The system is intentionally strict here. It shows bad rows, duplicates, and accepted records separately so advisors can trust the data trail.

### Step 4: Run Risk Scan

Return to **Dashboard** and click **Run Risk Scan**.

Say:

> The rules engine runs the configured VAT, WHT, and PAYE checks and updates the client risk profile.

Explain:

- VAT checks use 18%.
- WHT checks use 15%.
- PAYE top-rate checks use 30%.
- Findings include severity, exposure, detection method, evidence, and legal reference.

### Step 5: Risk Review

Open **Tax Risks**.

Say:

> Each flag is reviewable and auditable. Advisors can mark a risk as reviewed, add internal notes, resolve it, or reopen it if more work is required.

Show:

- Severity badge
- Rule code
- Detection method
- Legal reference
- Evidence
- Add Note
- Mark Reviewed
- Resolve

### Step 6: Reports

Open **Reports**.

Say:

> Once risk review is complete, the advisor can generate a Tax Health Check report for the client.

Show:

- Select client
- Generate Report
- Open report

## 5. What Has Been Delivered

Use this exact summary when asked what is complete:

- Secure login and admin workspace.
- Client creation and management.
- CSV transaction import.
- Validation and duplicate detection.
- Import traceability.
- VAT, WHT, and PAYE risk rules.
- Evidence-based risk flags.
- Advisory risk lifecycle.
- Client activity trail.
- Portfolio dashboard.
- Advisory report generation.
- Docker-based local deployment.
- Supabase readiness checks.

## 6. Phase Positioning

If asked about project phases:

### Phase 1

Foundation, authentication, schema, local Docker deployment, audit logs.

### Phase 2

Reliable ingestion: validation, duplicate detection, upload tracking, client/advisor association.

### Phase 3

Rules engine: VAT, WHT, PAYE, evidence, legal references, exposure scoring.

### Phase 4

Advisory workflow: dashboard, risk review, notes, resolution, reopen, client management.

## 7. Questions and Best Answers

### Is this production-ready?

Answer:

> The core workflow is ready for controlled production rollout. Before public launch, we would finalize hosting, SSL, backup policy, user onboarding, and client-specific rule configuration.

### Is the system using real tax rules?

Answer:

> The current rule set is configured for Uganda advisory checks, including VAT, withholding tax, and PAYE assumptions. Each rule is separated from the UI and can be refined as policy or client needs evolve.

### Can this support multiple clients?

Answer:

> Yes. The system is designed around client workspaces, advisor assignments, and portfolio-level oversight.

### Can risks be audited later?

Answer:

> Yes. Risk flags include evidence, review status, internal notes, and activity logs so the advisory process is traceable.

### Can we deploy it online?

Answer:

> Yes. It can be deployed with Docker on a VPS, hosted on Replit for review environments, or served behind Apache/Nginx with the API running separately.

## 8. Things Not to Say

Avoid:

- "It is a mockup."
- "The database is empty."
- "This button was just added."
- "The AI made this."
- "It is not ready."
- "We still need to figure out deployment."

Use:

- "This release focuses on the core advisory workflow."
- "The platform is structured for controlled rollout."
- "The rules can be expanded by tax category, jurisdiction, and client profile."

## 9. Demo Recovery Plan

If login fails:

- Refresh once.
- Re-enter admin credentials.
- If still failing, show screenshots or describe the workflow from the current screen.

If data is empty:

- Create a client.
- Import the prepared CSV.
- Run Risk Scan.

If Supabase is slow:

- Say:

> The app is connected to a managed cloud database, so the workflow depends on network availability. For production, we would host with monitoring and uptime controls.

## 10. Closing Statement

Use this:

> The value of TaxIntel is that it turns raw client transactions into a structured advisory workflow. It helps the team see exposure, explain why a risk was flagged, track review actions, and produce a client-facing report from the same system.

Then ask:

> Would you like us to walk through a real client file next, or focus on rollout planning?

## 11. Post-Meeting Follow-Up

After the pitch, send:

- Access URL.
- Short feature summary.
- Screenshots of dashboard, risks, and report.
- Required deployment decision: Replit, VPS Docker, or hosted infrastructure.
- Any client-specific rule changes requested.

## 12. Owner Talking Points

- This is not just a dashboard; it is an advisory workflow.
- The system supports repeatable client reviews.
- Every import and risk action is traceable.
- The rules engine is separated from the UI, so it can mature over time.
- The current version is suitable for controlled rollout and client validation.
