import { Router, type IRouter } from "express";
import { db, profilesTable } from "../lib/db.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

const fmt = (u: typeof profilesTable.$inferSelect) => ({
  id: u.id, email: u.email, fullName: u.fullName, role: u.role,
  companyId: u.companyId ?? null, createdAt: u.createdAt,
});

router.get("/auth/me", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [user] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(user));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  try {
    const [user] = await db.select().from(profilesTable).where(eq(profilesTable.email, email.toLowerCase())).limit(1);
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json(fmt(user));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/signup", async (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) { res.status(400).json({ error: "Email, password, and full name required" }); return; }
  try {
    const [existing] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.email, email.toLowerCase())).limit(1);
    if (existing) { res.status(400).json({ error: "Email already registered" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const allowed = ["advisor", "client_user", "admin"];
    const userRole = allowed.includes(role) ? role : "advisor";
    const [user] = await db.insert(profilesTable).values({ email: email.toLowerCase(), fullName, role: userRole, passwordHash, companyId: null }).returning();
    res.status(201).json(fmt(user));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/logout", (_req, res) => { res.json({ success: true }); });

export default router;
