import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.get("/auth/me", async (req, res) => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: data.id, email: data.email, fullName: data.full_name, role: data.role, companyId: data.company_id ?? null, createdAt: data.created_at });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("email", email.toLowerCase()).single();
    if (error || !data) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json({ id: data.id, email: data.email, fullName: data.full_name, role: data.role, companyId: data.company_id ?? null, createdAt: data.created_at });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/signup", async (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) { res.status(400).json({ error: "Email, password, and full name required" }); return; }
  try {
    const { data: existing } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).single();
    if (existing) { res.status(400).json({ error: "Email already registered" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const allowed = ["advisor", "client_user", "admin"];
    const userRole = allowed.includes(role) ? role : "advisor";
    const { data, error } = await supabase.from("profiles").insert({ email: email.toLowerCase(), full_name: fullName, role: userRole, password_hash: passwordHash, company_id: null }).select().single();
    if (error || !data) { res.status(500).json({ error: error?.message ?? "Failed to create user" }); return; }
    res.status(201).json({ id: data.id, email: data.email, fullName: data.full_name, role: data.role, companyId: data.company_id ?? null, createdAt: data.created_at });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/auth/logout", (_req, res) => { res.json({ success: true }); });

export default router;
