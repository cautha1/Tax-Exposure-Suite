import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; role?: string; company_id?: string };
  created_at?: string;
}

const fmt = (u: AuthUser) => ({
  id: u.id,
  email: u.email ?? null,
  fullName: u.user_metadata?.full_name ?? null,
  role: u.user_metadata?.role ?? "advisor",
  companyId: u.user_metadata?.company_id ?? null,
  createdAt: u.created_at ?? new Date().toISOString(),
});

router.get("/auth/me", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !user) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(user));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });
    if (error || !data.user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json(fmt(data.user));
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
    const allowed = ["advisor", "client_user", "admin"];
    const userRole = allowed.includes(role) ? role : "advisor";

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      user_metadata: { full_name: fullName, role: userRole },
      email_confirm: true,
    });

    if (error) {
      if (error.message.toLowerCase().includes("already") || error.message.toLowerCase().includes("duplicate")) {
        res.status(400).json({ error: "An account with this email already exists" });
        return;
      }
      throw new Error(error.message);
    }

    res.status(201).json(fmt(data.user));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/profile", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { fullName, email, role, currentPassword, newPassword } = req.body;

    const { data: { user: current }, error: fetchErr } = await supabase.auth.admin.getUserById(userId);
    if (fetchErr || !current) { res.status(404).json({ error: "User not found" }); return; }

    const updates: Record<string, unknown> = {};
    const metaUpdates = { ...current.user_metadata };

    if (fullName) metaUpdates.full_name = fullName;
    if (role && current.user_metadata?.role === "admin") {
      const allowed = ["advisor", "client_user", "admin"];
      if (allowed.includes(role)) metaUpdates.role = role;
    }

    if (newPassword) {
      if (!currentPassword) { res.status(400).json({ error: "Current password required to set new password" }); return; }
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: current.email!, password: currentPassword,
      });
      if (verifyErr) { res.status(401).json({ error: "Current password is incorrect" }); return; }
      if (newPassword.length < 6) { res.status(400).json({ error: "New password must be at least 6 characters" }); return; }
      updates.password = newPassword;
    }

    if (email && email.toLowerCase() !== current.email) {
      updates.email = email.toLowerCase();
    }

    updates.user_metadata = metaUpdates;

    const { data, error } = await supabase.auth.admin.updateUserById(userId, updates);
    if (error) throw new Error(error.message);

    res.json(fmt(data.user));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/logout", (_req, res) => { res.json({ success: true }); });

export default router;
