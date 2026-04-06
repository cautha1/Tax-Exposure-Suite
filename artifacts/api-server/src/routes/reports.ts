import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";

const router: IRouter = Router();

interface Report {
  id: string;
  companyId: string;
  title: string | null;
  status: string | null;
  summary: string | null;
  totalExposure: string | number | null;
  highRisks: number | null;
  mediumRisks: number | null;
  lowRisks: number | null;
  createdAt: string;
}

const fmtReport = (r: Report, companyName?: string) => ({
  id: r.id, companyId: r.companyId, title: r.title ?? null, status: r.status ?? null,
  summary: r.summary ?? null, totalExposure: r.totalExposure != null ? Number(r.totalExposure) : null,
  highRisks: r.highRisks ?? null, mediumRisks: r.mediumRisks ?? null, lowRisks: r.lowRisks ?? null,
  companyName: companyName ?? null, createdAt: r.createdAt,
});

router.get("/reports", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    let q = supabase.from("reports").select("*").order("created_at", { ascending: false });
    if (companyId) q = q.eq("company_id", companyId);
    const { data: rows, error } = await q;
    sbErr(error, "list reports");

    const { data: companiesRaw } = await supabase.from("companies").select("id, company_name");
    const companyMap: Record<string, string> = Object.fromEntries(
      (companiesRaw ?? []).map((c: Record<string, unknown>) => [c.id, c.company_name])
    );
    res.json((rows ?? []).map((r: unknown) => {
      const report = toCamel<Report>(r);
      return fmtReport(report, companyMap[report.companyId]);
    }));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/reports", async (req, res) => {
  try {
    const { companyId, title } = req.body;
    if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }

    const { data: companyRaw, error: coErr } = await supabase.from("companies").select("*").eq("id", companyId).single();
    if (coErr || !companyRaw) { res.status(404).json({ error: "Company not found" }); return; }
    const company = toCamel<{ id: string; companyName: string }>(companyRaw);

    const { data: risksRaw } = await supabase.from("tax_risk_flags").select("status, severity, estimated_exposure").eq("company_id", companyId);
    const risks = (risksRaw ?? []).map((r: unknown) => toCamel<{ status: string; severity: string; estimatedExposure: string }>(r));
    const openRisks = risks.filter(r => r.status === "open");
    const highRisks = openRisks.filter(r => r.severity === "high").length;
    const mediumRisks = openRisks.filter(r => r.severity === "medium").length;
    const lowRisks = openRisks.filter(r => r.severity === "low").length;
    const totalExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);

    const reportTitle = title || `Tax Exposure Report - ${company.companyName} - ${new Date().toLocaleDateString()}`;
    const summary = `Analysis for ${company.companyName}. Found ${openRisks.length} open risk flags with estimated total exposure of UGX ${totalExposure.toLocaleString()}. High: ${highRisks}, Medium: ${mediumRisks}, Low: ${lowRisks}.`;

    const { data, error } = await supabase.from("reports").insert({
      company_id: companyId, title: reportTitle, status: "ready", summary,
      total_exposure: totalExposure, high_risks: highRisks, medium_risks: mediumRisks, low_risks: lowRisks,
    }).select().single();
    sbErr(error, "insert report");
    res.status(201).json(fmtReport(toCamel<Report>(data), company.companyName));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/reports/:id", async (req, res) => {
  try {
    const { data: raw, error } = await supabase.from("reports").select("*").eq("id", req.params.id).single();
    if (error || !raw) { res.status(404).json({ error: "Not found" }); return; }
    const row = toCamel<Report>(raw);
    const { data: coRaw } = await supabase.from("companies").select("company_name").eq("id", row.companyId).single();
    res.json(fmtReport(row, (coRaw as Record<string, unknown>)?.company_name as string | undefined));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
