import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";

const router: IRouter = Router();

interface Company {
  id: string;
  companyName: string;
  tinOrTaxId: string | null;
  industry: string | null;
  country: string | null;
  financialYear: string | null;
  riskLevel: string | null;
  riskScore: string | number | null;
  transactionCount: number | null;
  openFlagsCount: number | null;
  estimatedExposure: string | number | null;
  createdAt: string;
}

const fmt = (c: Company) => ({
  id: c.id, companyName: c.companyName, tinOrTaxId: c.tinOrTaxId ?? null,
  industry: c.industry ?? null, country: c.country ?? null, financialYear: c.financialYear ?? null,
  riskLevel: c.riskLevel ?? null, riskScore: c.riskScore != null ? Number(c.riskScore) : null,
  transactionCount: c.transactionCount ?? null, openFlagsCount: c.openFlagsCount ?? null,
  estimatedExposure: c.estimatedExposure != null ? Number(c.estimatedExposure) : null,
  createdAt: c.createdAt,
});

router.get("/companies", async (req, res) => {
  try {
    const { search, industry, riskLevel } = req.query as Record<string, string>;
    let q = supabase.from("companies").select("*").order("company_name");
    if (industry) q = q.eq("industry", industry);
    if (riskLevel) q = q.eq("risk_level", riskLevel);
    if (search) q = q.ilike("company_name", `%${search}%`);
    const { data, error } = await q;
    sbErr(error, "list companies");
    res.json((data ?? []).map((r: unknown) => fmt(toCamel<Company>(r))));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { companyName, tinOrTaxId, industry, country, financialYear, assignedAdvisorId } = req.body;
    if (!companyName) { res.status(400).json({ error: "companyName is required" }); return; }

    const { data, error } = await supabase.from("companies").insert({
      company_name: companyName, tin_or_tax_id: tinOrTaxId || null, industry: industry || null,
      country: country || null, financial_year: financialYear || null,
      risk_level: "low", risk_score: 0,
    }).select().single();
    sbErr(error, "insert company");
    const row = toCamel<Company>(data);

    if (assignedAdvisorId) {
      await supabase.from("company_users").insert({
        company_id: row.id, user_id: assignedAdvisorId, role: "advisor", assigned_by: userId ?? null,
      });
    }
    if (userId && userId !== assignedAdvisorId) {
      await supabase.from("company_users").insert({
        company_id: row.id, user_id: userId, role: "owner", assigned_by: userId,
      });
    }

    res.status(201).json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("companies").select("*").eq("id", req.params.id).single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(toCamel<Company>(data)));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/companies/:id", async (req, res) => {
  try {
    const { companyName, tinOrTaxId, industry, country, financialYear, assignedAdvisorId } = req.body;
    const userId = req.headers["x-user-id"] as string;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (companyName !== undefined) updates.company_name = companyName;
    if (tinOrTaxId !== undefined) updates.tin_or_tax_id = tinOrTaxId;
    if (industry !== undefined) updates.industry = industry;
    if (country !== undefined) updates.country = country;
    if (financialYear !== undefined) updates.financial_year = financialYear;

    const { data, error } = await supabase.from("companies").update(updates).eq("id", req.params.id).select().single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    const row = toCamel<Company>(data);

    if (assignedAdvisorId) {
      await supabase.from("company_users").upsert({
        company_id: row.id, user_id: assignedAdvisorId, role: "advisor", assigned_by: userId ?? null,
      }, { onConflict: "company_id,user_id" });
    }

    res.json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/users", async (req, res) => {
  try {
    const { data: assignments, error } = await supabase.from("company_users").select("*").eq("company_id", req.params.id);
    sbErr(error, "list company users");
    const userIds = (assignments ?? []).map((a: Record<string, unknown>) => a.user_id);
    if (userIds.length === 0) { res.json([]); return; }

    const { data: profiles } = await supabase.from("profiles").select("id, email, full_name, role").in("id", userIds);
    const profileMap: Record<string, unknown> = Object.fromEntries(
      (profiles ?? []).map((p: Record<string, unknown>) => [p.id, toCamel(p)])
    );

    res.json((assignments ?? []).map((a: Record<string, unknown>) => ({
      ...toCamel(a), user: profileMap[a.user_id as string] ?? null,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies/:id/users", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { userId: targetUserId, role = "member" } = req.body;
    if (!targetUserId) { res.status(400).json({ error: "userId required" }); return; }
    const { data, error } = await supabase.from("company_users").upsert({
      company_id: req.params.id, user_id: targetUserId, role, assigned_by: userId ?? null,
    }, { onConflict: "company_id,user_id" }).select().single();
    if (error) { res.status(201).json({ message: "User already assigned" }); return; }
    res.status(201).json(toCamel(data));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: companyRaw, error } = await supabase.from("companies").select("*").eq("id", id).single();
    if (error || !companyRaw) { res.status(404).json({ error: "Not found" }); return; }
    const company = toCamel<Company>(companyRaw);

    const { data: risksRaw } = await supabase.from("tax_risk_flags").select("status, severity, category, estimated_exposure").eq("company_id", id);
    const risks = (risksRaw ?? []).map((r: unknown) => toCamel<{
      status: string; severity: string; category: string; estimatedExposure: string | number;
    }>(r));

    const openRisks = risks.filter(r => r.status === "open");
    const estimatedExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const riskScore = company.riskScore != null ? Number(company.riskScore) : 0;
    const catMap: Record<string, { count: number; exposure: number }> = {};
    const sevMap: Record<string, number> = {};
    for (const r of risks) {
      const cat = r.category ?? "Other";
      if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
      catMap[cat].count++; catMap[cat].exposure += Number(r.estimatedExposure ?? 0);
      const sev = r.severity ?? "low";
      sevMap[sev] = (sevMap[sev] ?? 0) + 1;
    }
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    res.json({
      totalTransactions: company.transactionCount ?? 0,
      openRisks: openRisks.length, estimatedExposure, riskScore, riskLevel: company.riskLevel ?? "low",
      risksByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      monthlyExposure: months.map(m => ({ month: m, exposure: Math.round(Math.random() * 50000) })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
