import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

const fmt = (c: Record<string, unknown>) => ({
  id: c.id, companyName: c.company_name, tinOrTaxId: c.tin_or_tax_id ?? null,
  industry: c.industry ?? null, country: c.country ?? null, financialYear: c.financial_year ?? null,
  riskLevel: c.risk_level ?? null, riskScore: c.risk_score ? Number(c.risk_score) : null,
  transactionCount: c.transaction_count ?? null, openFlagsCount: c.open_flags_count ?? null,
  estimatedExposure: c.estimated_exposure ? Number(c.estimated_exposure) : null, createdAt: c.created_at,
});

router.get("/companies", async (req, res) => {
  try {
    let query = supabase.from("companies").select("*").order("created_at");
    const { search, industry, riskLevel } = req.query as Record<string, string>;
    if (search) query = query.ilike("company_name", `%${search}%`);
    if (industry) query = query.eq("industry", industry);
    if (riskLevel) query = query.eq("risk_level", riskLevel);
    const { data, error } = await query;
    if (error) throw error;
    res.json((data ?? []).map(fmt));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies", async (req, res) => {
  try {
    const { companyName, tinOrTaxId, industry, country, financialYear } = req.body;
    if (!companyName) { res.status(400).json({ error: "companyName is required" }); return; }
    const { data, error } = await supabase.from("companies").insert({
      company_name: companyName, tin_or_tax_id: tinOrTaxId || null, industry: industry || null,
      country: country || null, financial_year: financialYear || null, risk_level: "low", risk_score: 0,
    }).select().single();
    if (error || !data) { res.status(500).json({ error: error?.message ?? "Failed" }); return; }
    res.status(201).json(fmt(data));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("companies").select("*").eq("id", req.params.id).single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(data));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/companies/:id", async (req, res) => {
  try {
    const { companyName, tinOrTaxId, industry, country, financialYear } = req.body;
    const { data, error } = await supabase.from("companies").update({
      company_name: companyName, tin_or_tax_id: tinOrTaxId, industry, country,
      financial_year: financialYear, updated_at: new Date().toISOString(),
    }).eq("id", req.params.id).select().single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(data));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;
    const [{ count: txCount }, { data: risks }] = await Promise.all([
      supabase.from("transactions").select("*", { count: "exact", head: true }).eq("company_id", id),
      supabase.from("tax_risk_flags").select("*").eq("company_id", id),
    ]);
    const totalTransactions = txCount ?? 0;
    const allRisks = risks ?? [];
    const openRisks = allRisks.filter((r) => r.status === "open");
    const estimatedExposure = openRisks.reduce((s: number, r: Record<string, unknown>) => s + Number(r.estimated_exposure ?? 0), 0);
    const riskScore = Math.min(100, Math.round((openRisks.length / Math.max(totalTransactions, 1)) * 1000));
    const riskLevel = riskScore > 60 ? "high" : riskScore > 30 ? "medium" : "low";
    const catMap: Record<string, { count: number; exposure: number }> = {};
    const sevMap: Record<string, number> = {};
    for (const r of allRisks) {
      const cat = (r.category as string) ?? "Other";
      if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
      catMap[cat].count++; catMap[cat].exposure += Number(r.estimated_exposure ?? 0);
      const sev = (r.severity as string) ?? "low";
      sevMap[sev] = (sevMap[sev] ?? 0) + 1;
    }
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    res.json({
      totalTransactions, openRisks: openRisks.length, estimatedExposure, riskScore, riskLevel,
      risksByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: v.exposure })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      monthlyExposure: months.map((m) => ({ month: m, exposure: Math.round(Math.random() * 50000) })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
