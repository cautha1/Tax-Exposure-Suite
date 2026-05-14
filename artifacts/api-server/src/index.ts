import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { supabaseAuth } from "./lib/supabase";

const rawPort = process.env["PORT"] ?? process.env["API_PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDemoUsers() {
  if (process.env.TAXINTEL_SEED_DEMO_USERS !== "true") return;

  const demoPassword = process.env.TAXINTEL_DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    logger.warn("Skipping demo user seed: TAXINTEL_DEMO_PASSWORD must be at least 12 characters");
    return;
  }

  const demo: Array<{ email: string; password: string; full_name: string; role: string }> = [
    { email: "admin@taxintel.com", password: demoPassword, full_name: "Admin User", role: "admin" },
    { email: "advisor@taxintel.com", password: demoPassword, full_name: "Tax Advisor", role: "advisor" },
  ];

  const { data: existing, error: listError } = await supabaseAuth.auth.admin.listUsers();
  if (listError) {
    logger.warn({ err: listError.message }, "Could not list users for demo seeding");
    return;
  }

  const existingUsers = (existing?.users ?? []) as Array<{ email?: string | null }>;
  for (const u of demo) {
    const found = existingUsers.find(x => x.email === u.email);
    if (!found) {
      const { error } = await supabaseAuth.auth.admin.createUser({
        email: u.email, password: u.password,
        user_metadata: { full_name: u.full_name, role: u.role },
        email_confirm: true,
      });
      if (error) {
        logger.warn({ email: u.email, err: error.message }, "Could not seed demo user");
      } else {
        logger.info({ email: u.email }, "Seeded demo user");
      }
    }
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  seedDemoUsers().catch(e => logger.warn({ err: e?.message }, "Demo user seeding failed (non-fatal)"));
});
