import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

const fmtRisk = (r: Record<string, unknown>, companyMap: Record<string, string>) => ({
  id: r.id, companyId: r.company_id, transactionId: r.transaction_id ?? null,
  ruleCode: r.rule_code ?? null, description: r.description ?? null,
  severity: r.severity ?? null, estimatedExposure: r.estimated_exposure ? Number(r.estimated_exposure) : null,
  status: r.status ?? null, category: r.category ?? null,
  companyName: companyMap[r.company_id as string] ?? null, createdAt: r.created_at,
});

router.get("/risks", async (req, res) => {
  try {
    const { companyId, severity, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const from = (pageNum - 1) * limitNum;

    let query = supabase.from("tax_risk_flags").select("*", { count: "exact" });
    if (companyId) query = query.eq("company_id", companyId);
    if (severity) query = query.eq("severity", severity);
    if (status) query = query.eq("status", status);
    const [{ data, error, count }, { data: companies }] = await Promise.all([
      query.range(from, from + limitNum - 1).order("created_at", { ascending: false }),
      supabase.from("companies").select("id, company_name"),
    ]);
    if (error) throw error;
    const companyMap = Object.fromEntries((companies ?? []).map((c: Record<string, string>) => [c.id, c.company_name]));
    res.json({ data: (data ?? []).map((r) => fmtRisk(r, companyMap)), total: count ?? 0, page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/risks/:id/resolve", async (req, res) => {
  try {
    const { data, error } = await supabase.from("tax_risk_flags").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    const { data: co } = await supabase.from("companies").select("open_flags_count").eq("id", data.company_id).single();
    if (co) {
      await supabase.from("companies").update({ open_flags_count: Math.max((co.open_flags_count ?? 1) - 1, 0), updated_at: new Date().toISOString() }).eq("id", data.company_id);
    }
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
