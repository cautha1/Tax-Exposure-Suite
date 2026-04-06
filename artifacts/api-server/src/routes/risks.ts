import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";

const router: IRouter = Router();

interface RiskFlag {
  id: string; companyId: string; transactionId: string | null; ruleCode: string | null;
  riskType: string | null; description: string | null; severity: string | null;
  estimatedExposure: string | number | null; status: string | null; category: string | null;
  confidence: string | null; riskScore: string | number | null;
  reviewedAt: string | null; reviewedBy: string | null; reviewNotes: string | null;
  resolvedBy: string | null; resolvedAt: string | null; internalNote: string | null;
  createdAt: string;
}

const fmtRisk = (r: RiskFlag, companyName?: string, transaction?: Record<string, unknown>) => ({
  id: r.id, companyId: r.companyId, transactionId: r.transactionId ?? null,
  ruleCode: r.ruleCode ?? null, riskType: r.riskType ?? null, description: r.description ?? null,
  severity: r.severity ?? null, estimatedExposure: r.estimatedExposure != null ? Number(r.estimatedExposure) : null,
  status: r.status ?? null, category: r.category ?? null, confidence: r.confidence ?? null,
  riskScore: r.riskScore != null ? Number(r.riskScore) : null,
  reviewedAt: r.reviewedAt ?? null, reviewedBy: r.reviewedBy ?? null, reviewNotes: r.reviewNotes ?? null,
  resolvedBy: r.resolvedBy ?? null, resolvedAt: r.resolvedAt ?? null, internalNote: r.internalNote ?? null,
  companyName: companyName ?? null, transaction: transaction ?? null, createdAt: r.createdAt,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/risks/summary", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    if (companyId && !UUID_RE.test(companyId)) {
      res.json({ openCount: 0, reviewedCount: 0, resolvedCount: 0, totalExposure: 0 });
      return;
    }
    let q = supabase.from("tax_risk_flags").select("status, estimated_exposure");
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q;
    sbErr(error, "risk summary");

    let openCount = 0, reviewedCount = 0, resolvedCount = 0, totalExposure = 0;
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      totalExposure += Number(r.estimated_exposure ?? 0);
      if (r.status === "open") openCount++;
      else if (r.status === "reviewed") reviewedCount++;
      else if (r.status === "resolved") resolvedCount++;
    }
    res.json({ openCount, reviewedCount, resolvedCount, totalExposure });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/risks", async (req, res) => {
  try {
    const {
      companyId, severity, status, riskType, category,
      search, dateFrom, dateTo, page = "1", limit = "50",
    } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    let q = supabase.from("tax_risk_flags").select("*", { count: "exact" });
    if (companyId) q = q.eq("company_id", companyId);
    if (severity) q = q.eq("severity", severity);
    if (status) q = q.eq("status", status);
    if (riskType) q = q.eq("risk_type", riskType);
    if (category) q = q.eq("category", category);
    if (search) q = q.or(`description.ilike.%${search}%,rule_code.ilike.%${search}%`);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) q = q.lte("created_at", new Date(dateTo).toISOString());

    const { data, error, count } = await q.order("created_at", { ascending: false }).range(offset, offset + limitNum - 1);
    sbErr(error, "list risks");

    const { data: companiesRaw } = await supabase.from("companies").select("id, company_name");
    const companyMap: Record<string, string> = Object.fromEntries(
      (companiesRaw ?? []).map((c: Record<string, unknown>) => [c.id, c.company_name])
    );

    res.json({
      data: (data ?? []).map((r: unknown) => {
        const flag = toCamel<RiskFlag>(r);
        return fmtRisk(flag, companyMap[flag.companyId]);
      }),
      total: count ?? 0, page: pageNum, limit: limitNum,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/risks/:id", async (req, res) => {
  try {
    const { data: raw, error } = await supabase.from("tax_risk_flags").select("*").eq("id", req.params.id).single();
    if (error || !raw) { res.status(404).json({ error: "Not found" }); return; }
    const risk = toCamel<RiskFlag>(raw);

    const { data: coRaw } = await supabase.from("companies").select("id, company_name, industry, country, risk_level, risk_score").eq("id", risk.companyId).single();
    const company = coRaw ? toCamel<{ id: string; companyName: string; industry: string | null; country: string | null; riskLevel: string | null; riskScore: string | null }>(coRaw) : null;

    let transaction: Record<string, unknown> | undefined;
    if (risk.transactionId) {
      const { data: txRaw } = await supabase.from("transactions").select("*").eq("id", risk.transactionId).single();
      if (txRaw) transaction = toCamel(txRaw) as Record<string, unknown>;
    }

    const companyFmt = company ? {
      id: company.id, companyName: company.companyName, industry: company.industry ?? null,
      country: company.country ?? null, riskLevel: company.riskLevel ?? null,
      riskScore: company.riskScore != null ? Number(company.riskScore) : null,
    } : null;

    res.json({ ...fmtRisk(risk, company?.companyName, transaction), company: companyFmt });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/risks/:id/review", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    const { reviewNotes } = req.body;
    const { data, error } = await supabase.from("tax_risk_flags").update({
      status: "reviewed", reviewed_at: new Date().toISOString(),
      reviewed_by: userId ?? null, review_notes: reviewNotes ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", req.params.id).select().single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, risk: fmtRisk(toCamel<RiskFlag>(data)) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/risks/:id/resolve", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
    const { reviewNotes } = req.body;
    const { data, error } = await supabase.from("tax_risk_flags").update({
      status: "resolved", resolved_at: new Date().toISOString(),
      resolved_by: userId ?? null, review_notes: reviewNotes ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", req.params.id).select().single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    const risk = toCamel<RiskFlag>(data);

    const { data: coRaw } = await supabase.from("companies").select("open_flags_count").eq("id", risk.companyId).single();
    if (coRaw) {
      const co = toCamel<{ openFlagsCount: number }>(coRaw);
      await supabase.from("companies").update({
        open_flags_count: Math.max((co.openFlagsCount ?? 1) - 1, 0),
        updated_at: new Date().toISOString(),
      }).eq("id", risk.companyId);
    }
    res.json({ success: true, risk: fmtRisk(risk) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/risks/:id/note", async (req, res) => {
  try {
    const { note } = req.body;
    if (typeof note !== "string") { res.status(400).json({ error: "note (string) is required" }); return; }
    const { data, error } = await supabase.from("tax_risk_flags").update({
      internal_note: note, updated_at: new Date().toISOString(),
    }).eq("id", req.params.id).select().single();
    if (error || !data) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, risk: fmtRisk(toCamel<RiskFlag>(data)) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
