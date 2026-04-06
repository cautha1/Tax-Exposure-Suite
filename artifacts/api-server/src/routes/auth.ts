import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  passwordHash: string;
  role: string | null;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

const fmt = (u: Profile) => ({
  id: u.id, email: u.email, fullName: u.fullName, role: u.role,
  companyId: u.companyId ?? null, createdAt: u.createdAt,
});

router.get("/auth/me", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(toCamel<Profile>(data)));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("email", email.toLowerCase()).maybeSingle();
    if (error || !data) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const user = toCamel<Profile>(data);
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
    const { data: existing } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (existing) { res.status(400).json({ error: "An account with this email already exists" }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    const allowed = ["advisor", "client_user", "admin"];
    const userRole = allowed.includes(role) ? role : "advisor";

    const { data, error } = await supabase.from("profiles").insert({
      email: email.toLowerCase(), full_name: fullName, role: userRole, password_hash: passwordHash, company_id: null,
    }).select().single();
    sbErr(error, "signup insert");
    res.status(201).json(fmt(toCamel<Profile>(data)));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/profile", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { fullName, email, role, currentPassword, newPassword } = req.body;
    const { data: raw } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!raw) { res.status(404).json({ error: "User not found" }); return; }
    const user = toCamel<Profile>(raw);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (fullName) updates.full_name = fullName;

    if (email && email !== user.email) {
      const { data: taken } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
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
      updates.password_hash = await bcrypt.hash(newPassword, 10);
    }

    const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().single();
    sbErr(error, "profile update");
    res.json(fmt(toCamel<Profile>(data)));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/logout", (_req, res) => { res.json({ success: true }); });

export default router;
