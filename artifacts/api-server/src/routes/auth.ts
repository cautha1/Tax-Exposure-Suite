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
  if (!email || !password || !fullName) {
    res.status(400).json({ error: "Email, password, and full name are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }
  try {
    const [existing] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.email, email.toLowerCase())).limit(1);
    if (existing) { res.status(400).json({ error: "An account with this email already exists" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const allowed = ["advisor", "client_user", "admin"];
    const userRole = allowed.includes(role) ? role : "advisor";
    const [user] = await db.insert(profilesTable).values({ email: email.toLowerCase(), fullName, role: userRole, passwordHash, companyId: null }).returning();
    res.status(201).json(fmt(user));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/profile", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { fullName, email, role, currentPassword, newPassword } = req.body;
    const [user] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const updates: Partial<typeof profilesTable.$inferInsert> = { updatedAt: new Date() };

    if (fullName) updates.fullName = fullName;

    if (email && email !== user.email) {
      const [taken] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.email, email.toLowerCase())).limit(1);
      if (taken) { res.status(400).json({ error: "Email already in use" }); return; }
      updates.email = email.toLowerCase();
    }

    if (role && user.role === "admin") {
      const allowed = ["advisor", "client_user", "admin"];
      if (allowed.includes(role)) updates.role = role;
    }

    if (newPassword) {
      if (!currentPassword) { res.status(400).json({ error: "Current password required to set new password" }); return; }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
      if (newPassword.length < 6) { res.status(400).json({ error: "New password must be at least 6 characters" }); return; }
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const [updated] = await db.update(profilesTable).set(updates).where(eq(profilesTable.id, userId)).returning();
    res.json(fmt(updated));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/logout", (_req, res) => { res.json({ success: true }); });

export default router;
