import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { supabase } from "./lib/supabase";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDemoUsers() {
  const demo = [
    { email: "admin@taxintel.com", password: "demo1234", full_name: "Admin User", role: "admin" },
    { email: "advisor@taxintel.com", password: "demo1234", full_name: "Tax Advisor", role: "advisor" },
  ];
  for (const u of demo) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = (existing?.users ?? []).find(x => x.email === u.email);
    if (!found) {
      const { error } = await supabase.auth.admin.createUser({
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
