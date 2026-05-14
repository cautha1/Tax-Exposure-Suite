import { Router, type IRouter } from "express";
import type { User, Session } from "@supabase/supabase-js";
import { supabaseAuth } from "../lib/supabase.js";
import {
  formatAuthUser,
  requireAuth,
  serializeAuthUser,
} from "../middleware/auth.js";

const router: IRouter = Router();

const PUBLIC_SIGNUP_ROLES = new Set(["advisor", "client_user"]);

function fmtSession(data: { user: User; session?: Session | null }) {
  return {
    user: serializeAuthUser(formatAuthUser(data.user)),
    accessToken: data.session?.access_token ?? null,
    refreshToken: data.session?.refresh_token ?? null,
    expiresAt: data.session?.expires_at ?? null,
  };
}

router.get("/auth/me", requireAuth, (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json(serializeAuthUser(req.user));
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });
    if (error || !data.user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    if (!data.session?.access_token) {
      res.status(401).json({ error: "Unable to create authenticated session" });
      return;
    }
    res.json(fmtSession({ user: data.user, session: data.session }));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/signup", async (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) {
    res.status(400).json({ error: "Email, password, and full name are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  try {
    const userRole = PUBLIC_SIGNUP_ROLES.has(role) ? role : "advisor";

    const { data, error } = await supabaseAuth.auth.admin.createUser({
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

    const { data: sessionData, error: loginErr } =
      await supabaseAuth.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
    if (loginErr || !sessionData.user || !sessionData.session?.access_token) {
      throw new Error(loginErr?.message ?? "Unable to create session");
    }

    res.status(201).json(
      fmtSession({ user: sessionData.user, session: sessionData.session }),
    );
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/profile", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { fullName, email, role, currentPassword, newPassword } = req.body;

    const { data: { user: current }, error: fetchErr } = await supabaseAuth.auth.admin.getUserById(userId);
    if (fetchErr || !current) { res.status(404).json({ error: "User not found" }); return; }

    const updates: Record<string, unknown> = {};
    const metaUpdates = { ...current.user_metadata };

    if (fullName) metaUpdates.full_name = fullName;
    if (role && req.user?.role === "admin") {
      const allowed = ["advisor", "client_user", "admin"];
      if (allowed.includes(role)) metaUpdates.role = role;
    }

    if (newPassword) {
      if (!currentPassword) { res.status(400).json({ error: "Current password required to set new password" }); return; }
      const { error: verifyErr } = await supabaseAuth.auth.signInWithPassword({
        email: current.email!, password: currentPassword,
      });
      if (verifyErr) { res.status(401).json({ error: "Current password is incorrect" }); return; }
      if (newPassword.length < 8) { res.status(400).json({ error: "New password must be at least 8 characters" }); return; }
      updates.password = newPassword;
    }

    if (email && email.toLowerCase() !== current.email) {
      updates.email = email.toLowerCase();
    }

    updates.user_metadata = metaUpdates;

    const { data, error } = await supabaseAuth.auth.admin.updateUserById(userId, updates);
    if (error) throw new Error(error.message);

    res.json(serializeAuthUser(formatAuthUser(data.user)));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/logout", requireAuth, (_req, res) => { res.json({ success: true }); });

export default router;
