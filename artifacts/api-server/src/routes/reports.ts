import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

const fmtReport = (r: Record<string, unknown>, companyName?: string) => ({
  id: r.id, companyId: r.company_id, title: r.title ?? null, status: r.status ?? null,
  summary: r.summary ?? null, totalExposure: r.total_exposure ? Number(r.total_exposure) : null,
  highRisks: r.high_risks ?? null, mediumRisks: r.medium_risks ?? null, lowRisks: r.low_risks ?? null,
  companyName: companyName ?? null, createdAt: r.created_at,
});

router.get("/reports", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    let query = supabase.from("reports").select("*").order("created_at", { ascending: false });
    if (companyId) query = query.eq("company_id", companyId);
    const [{ data, error }, { data: companies }] = await Promise.all([query, supabase.from("companies").select("id, company_name")]);
    if (error) throw error;
    const companyMap = Object.fromEntries((companies ?? []).map((c: Record<string, string>) => [c.id, c.company_name]));
    res.json((data ?? []).map((r) => fmtReport(r, companyMap[r.company_id as string])));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/reports", async (req, res) => {
  try {
    const { companyId, title } = req.body;
    if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }
    const [{ data: company }, { data: risks }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).single(),
      supabase.from("tax_risk_flags").select("*").eq("company_id", companyId),
    ]);
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }
    const openRisks = (risks ?? []).filter((r: Record<string, unknown>) => r.status === "open");
    const highRisks = openRisks.filter((r: Record<string, unknown>) => r.severity === "high").length;
    const mediumRisks = openRisks.filter((r: Record<string, unknown>) => r.severity === "medium").length;
    const lowRisks = openRisks.filter((r: Record<string, unknown>) => r.severity === "low").length;
    const totalExposure = openRisks.reduce((s: number, r: Record<string, unknown>) => s + Number(r.estimated_exposure ?? 0), 0);
    const reportTitle = title || `Tax Exposure Report - ${company.company_name} - ${new Date().toLocaleDateString()}`;
    const summary = `Analysis for ${company.company_name}. Found ${openRisks.length} open risk flags with estimated total exposure of $${totalExposure.toLocaleString()}. High: ${highRisks}, Medium: ${mediumRisks}, Low: ${lowRisks}.`;
    const { data, error } = await supabase.from("reports").insert({ company_id: companyId, title: reportTitle, status: "ready", summary, total_exposure: totalExposure, high_risks: highRisks, medium_risks: mediumRisks, low_risks: lowRisks }).select().single();
    if (error || !data) { res.status(500).json({ error: error?.message ?? "Failed" }); return; }
    res.status(201).json(fmtReport(data, company.company_name));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/reports/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("reports").select("*").eq("id", req.params.id).single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    const { data: co } = await supabase.from("companies").select("company_name").eq("id", data.company_id).single();
    res.json(fmtReport(data, co?.company_name));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
