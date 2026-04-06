import { Router, type IRouter } from "express";
import { supabase, toCamel } from "../lib/supabase.js";

const router: IRouter = Router();

function riskLevelFromScore(score: number): string {
  if (score > 75) return "critical";
  if (score > 50) return "high";
  if (score > 20) return "medium";
  return "low";
}

router.get("/risk-score/company/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: companyRaw, error } = await supabase.from("companies").select("*").eq("id", id).single();
    if (error || !companyRaw) { res.status(404).json({ error: "Company not found" }); return; }
    const company = toCamel<{ id: string; companyName: string; riskScore: string | null }>(companyRaw);

    const { data: flagsRaw } = await supabase.from("tax_risk_flags").select("severity, category, estimated_exposure").eq("company_id", id);
    const flags = (flagsRaw ?? []).map((f: unknown) => toCamel<{
      severity: string; category: string; estimatedExposure: string;
    }>(f));

    let totalExposure = 0;
    const bySeverity: Record<string, { count: number; exposure: number }> = {
      high: { count: 0, exposure: 0 }, medium: { count: 0, exposure: 0 }, low: { count: 0, exposure: 0 },
    };
    const byCategory: Record<string, { count: number; exposure: number }> = {};

    for (const f of flags) {
      const exp = Number(f.estimatedExposure ?? 0);
      totalExposure += exp;
      const sev = f.severity ?? "low";
      if (!bySeverity[sev]) bySeverity[sev] = { count: 0, exposure: 0 };
      bySeverity[sev].count++; bySeverity[sev].exposure += exp;
      const cat = f.category ?? "Other";
      if (!byCategory[cat]) byCategory[cat] = { count: 0, exposure: 0 };
      byCategory[cat].count++; byCategory[cat].exposure += exp;
    }

    const overallScore = company.riskScore ? Number(company.riskScore) : 0;
    const riskLevel = riskLevelFromScore(overallScore);

    res.json({
      companyId: id, companyName: company.companyName, overallScore, riskLevel,
      breakdown: {
        bySeverity: Object.entries(bySeverity).map(([severity, v]) => ({ severity, count: v.count, exposure: Math.round(v.exposure) })),
        byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
        totalExposure: Math.round(totalExposure),
      },
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
