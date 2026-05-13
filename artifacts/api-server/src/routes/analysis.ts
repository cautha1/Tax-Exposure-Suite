import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";
import { requireCompanyManager } from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import {
  buildRuleContext,
  runTaxRules,
  type RuleTransaction,
} from "../lib/rules-engine.js";

const router: IRouter = Router();

router.post("/analysis/run", async (req, res) => {
  try {
    const { companyId, clearExisting = true } = req.body;
    if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }
    if (!(await requireCompanyManager(req, res, companyId))) return;

    const { data: companyRaw, error: coErr } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();
    if (coErr || !companyRaw) { res.status(404).json({ error: "Company not found" }); return; }

    const { data: txRaw, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("company_id", companyId)
      .eq("validation_status", "valid");
    sbErr(txErr, "list transactions for analysis");
    const allTx = (txRaw ?? []).map((t: unknown) => toCamel<RuleTransaction>(t));

    const { data: rulesRaw, error: rulesErr } = await supabase
      .from("optional_rules_config")
      .select("*")
      .eq("enabled", true)
      .or(`company_id.eq.${companyId},company_id.is.null`);
    sbErr(rulesErr, "list enabled rules");

    const rulesConfig = (rulesRaw ?? []).map((r: unknown) =>
      toCamel<{ ruleCode: string; threshold: string | null }>(r),
    );
    const { enabledRules, thresholds } = buildRuleContext(rulesConfig);

    if (clearExisting) {
      await supabase
        .from("tax_risk_flags")
        .delete()
        .eq("company_id", companyId)
        .eq("status", "open");
    }

    const allFlags = runTaxRules(allTx, enabledRules, thresholds);

    if (allFlags.length > 0) {
      const { error: flagErr } = await supabase.from("tax_risk_flags").insert(allFlags);
      sbErr(flagErr, "insert flags");
    }

    const totalExposure = allFlags.reduce((s, f) => s + f.estimated_exposure, 0);
    const highCount = allFlags.filter(f => f.severity === "high").length;
    const medCount = allFlags.filter(f => f.severity === "medium").length;
    const lowCount = allFlags.filter(f => f.severity === "low").length;

    const catMap: Record<string, { count: number; exposure: number }> = {};
    const methodMap: Record<string, number> = {};
    for (const f of allFlags) {
      if (!catMap[f.category]) catMap[f.category] = { count: 0, exposure: 0 };
      catMap[f.category].count++;
      catMap[f.category].exposure += f.estimated_exposure;
      methodMap[f.detection_method] = (methodMap[f.detection_method] ?? 0) + 1;
    }

    const MAX_FLAG_SCORE = 18;
    const sumFlagScores = allFlags.reduce((s, f) => s + f.risk_score, 0);
    const riskScore = Math.min(100, Math.round((sumFlagScores / Math.max(allTx.length, 1)) * (100 / MAX_FLAG_SCORE)));
    const riskLevel = riskScore > 75 ? "critical" : riskScore > 50 ? "high" : riskScore > 20 ? "medium" : "low";

    await supabase.from("companies").update({
      open_flags_count: allFlags.length,
      risk_score: riskScore,
      risk_level: riskLevel,
      estimated_exposure: totalExposure,
      updated_at: new Date().toISOString(),
    }).eq("id", companyId);

    await writeAuditLog(req, {
      action: "analysis.run",
      entityType: "company",
      entityId: companyId,
      companyId,
      metadata: {
        transactionsAnalysed: allTx.length,
        totalFlags: allFlags.length,
        totalEstimatedExposure: totalExposure,
        riskScore,
        riskLevel,
        rulesApplied: [...enabledRules],
        deterministicFlags: methodMap.deterministic ?? 0,
        heuristicFlags: methodMap.heuristic ?? 0,
        clearExisting,
      },
    });

    res.json({
      companyId,
      transactionsAnalysed: allTx.length,
      totalFlags: allFlags.length,
      totalEstimatedExposure: totalExposure,
      riskScore,
      riskLevel,
      taxJurisdiction: "Uganda (URA)",
      vatRate: "18%",
      whtRate: "15%",
      payeTopRate: "30%",
      severityBreakdown: { high: highCount, medium: medCount, low: lowCount },
      detectionMethods: {
        deterministic: methodMap.deterministic ?? 0,
        heuristic: methodMap.heuristic ?? 0,
      },
      byCategory: Object.entries(catMap).map(([category, v]) => ({
        category,
        count: v.count,
        exposure: Math.round(v.exposure),
      })),
      rulesApplied: [...enabledRules],
      message: `Analysis complete under Uganda tax rules. ${allFlags.length} risk indicators found across ${allTx.length} valid transactions.`,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
