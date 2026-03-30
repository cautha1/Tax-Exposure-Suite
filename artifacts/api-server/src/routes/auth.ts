import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.get("/auth/me", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    if (!profiles.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const p = profiles[0];
    res.json({
      id: p.id,
      email: p.email,
      fullName: p.fullName,
      role: p.role,
      companyId: p.companyId ?? null,
      createdAt: p.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  try {
    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.email, email.toLowerCase()))
      .limit(1);
    if (!profiles.length) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const profile = profiles[0];
    const valid = await bcrypt.compare(password, profile.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    res.json({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      companyId: profile.companyId ?? null,
      createdAt: profile.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/signup", async (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) {
    res.status(400).json({ error: "Email, password, and full name required" });
    return;
  }
  try {
    const existing = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.email, email.toLowerCase()))
      .limit(1);
    if (existing.length) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const allowed = ["advisor", "client_user", "admin"];
    const userRole = allowed.includes(role) ? role : "advisor";
    const inserted = await db
      .insert(profilesTable)
      .values({
        email: email.toLowerCase(),
        fullName,
        role: userRole,
        passwordHash,
        companyId: null,
      })
      .returning();
    const profile = inserted[0];
    res.status(201).json({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      companyId: profile.companyId ?? null,
      createdAt: profile.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});

export default router;
