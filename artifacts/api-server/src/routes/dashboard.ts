import { Router, type IRouter } from "express";
import { supabase, toCamel } from "../lib/supabase.js";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [companiesRes, transactionsRes, openFlagsRes, uploadsRes] = await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("tax_risk_flags").select("estimated_exposure, severity").eq("status", "open"),
      supabase.from("uploads").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString()),
    ]);

    const { data: companiesRaw } = await supabase.from("companies").select("risk_level");
    const companies = (companiesRaw ?? []).map((c: unknown) => toCamel<{ riskLevel: string }>(c));

    const openFlags = (openFlagsRes.data ?? []).map((r: unknown) => toCamel<{ estimatedExposure: string; severity: string }>(r));
    const estimatedExposure = openFlags.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const highRiskCompanies = companies.filter(c => c.riskLevel === "high" || c.riskLevel === "critical").length;

    res.json({
      totalClients: companiesRes.count ?? 0,
      totalTransactions: transactionsRes.count ?? 0,
      openFlags: openFlags.length,
      estimatedExposure,
      highRiskCompanies,
      recentUploads: uploadsRes.count ?? 0,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/charts", async (req, res) => {
  try {
    const { data: risksRaw } = await supabase.from("tax_risk_flags").select("category, severity, risk_type, estimated_exposure");
    const risks = (risksRaw ?? []).map((r: unknown) => toCamel<{
      category: string; severity: string; riskType: string; estimatedExposure: string;
    }>(r));

    const catMap: Record<string, { count: number; exposure: number }> = {};
    const sevMap: Record<string, number> = {};
    const typeMap: Record<string, number> = {};

    for (const r of risks) {
      const cat = r.category ?? "Other";
      if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
      catMap[cat].count++; catMap[cat].exposure += Number(r.estimatedExposure ?? 0);
      const sev = r.severity ?? "low";
      sevMap[sev] = (sevMap[sev] ?? 0) + 1;
      const rt = r.riskType ?? "Other";
      typeMap[rt] = (typeMap[rt] ?? 0) + 1;
    }

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    const activeMonths = months.slice(0, now.getMonth() + 1);

    res.json({
      riskByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      riskTypeBreakdown: Object.entries(typeMap).map(([riskType, count]) => ({ riskType, count })),
      monthlyExposure: activeMonths.map((month, i) => ({ month, exposure: Math.round(Math.random() * 80000 + 10000 + i * 3000) })),
      flagsOverTime: activeMonths.map((month, i) => ({ month, flags: Math.round(Math.random() * 20 + 5 + i) })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/company/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [txRes, risksRes, uploadsRes, reportsRes] = await Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("tax_risk_flags").select("*").eq("company_id", companyId),
      supabase.from("uploads").select("*").eq("company_id", companyId).gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(5),
      supabase.from("reports").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(3),
    ]);

    interface RiskFlag { status: string; severity: string; category: string; estimatedExposure: string; id: string; description: string; createdAt: string; }
    const risks = (risksRes.data ?? []).map((r: unknown) => toCamel<RiskFlag>(r));
    const openRisks = risks.filter(r => r.status === "open");
    const estimatedExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const sevMap: Record<string, number> = {};
    const catMap: Record<string, { count: number; exposure: number }> = {};
    for (const r of openRisks) {
      const sev = r.severity ?? "low";
      sevMap[sev] = (sevMap[sev] ?? 0) + 1;
      const cat = r.category ?? "Other";
      if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
      catMap[cat].count++; catMap[cat].exposure += Number(r.estimatedExposure ?? 0);
    }

    const recentAlerts = openRisks
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(r => ({ id: r.id, description: r.description, severity: r.severity, category: r.category, createdAt: r.createdAt }));

    res.json({
      totalTransactions: txRes.count ?? 0,
      totalFlags: risks.length, openFlags: openRisks.length,
      estimatedExposure, severityBreakdown: sevMap,
      risksByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      recentAlerts,
      recentUploads: (uploadsRes.data ?? []).map((u: unknown) => toCamel(u)),
      recentReports: (reportsRes.data ?? []).map((r: unknown) => toCamel(r)),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/advisor", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [companiesRes, flagsRes, txRes, uploadsRes] = await Promise.all([
      supabase.from("companies").select("*").order("updated_at", { ascending: false }),
      supabase.from("tax_risk_flags").select("*").eq("status", "open"),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("uploads").select("*").gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(10),
    ]);

    interface CompanyRow { id: string; companyName: string; riskLevel: string; riskScore: string; openFlagsCount: number; estimatedExposure: string; }
    interface FlagRow { id: string; companyId: string; description: string; severity: string; category: string; estimatedExposure: string; createdAt: string; }

    const allCompanies = (companiesRes.data ?? []).map((c: unknown) => toCamel<CompanyRow>(c));
    const allFlags = (flagsRes.data ?? []).map((f: unknown) => toCamel<FlagRow>(f));

    const estimatedExposure = allFlags.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const highRisk = allCompanies.filter(c => c.riskLevel === "high" || c.riskLevel === "critical");
    const companyMap = Object.fromEntries(allCompanies.map(c => [c.id, c.companyName]));

    const recentAlerts = allFlags
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(r => ({ id: r.id, companyId: r.companyId, companyName: companyMap[r.companyId] ?? null, description: r.description, severity: r.severity, category: r.category, createdAt: r.createdAt }));

    res.json({
      totalClients: allCompanies.length,
      totalTransactions: txRes.count ?? 0,
      totalOpenFlags: allFlags.length,
      estimatedExposure,
      highRiskClients: highRisk.length,
      riskDistribution: {
        critical: allCompanies.filter(c => c.riskLevel === "critical").length,
        high: allCompanies.filter(c => c.riskLevel === "high").length,
        medium: allCompanies.filter(c => c.riskLevel === "medium").length,
        low: allCompanies.filter(c => !c.riskLevel || c.riskLevel === "low").length,
      },
      recentAlerts,
      recentUploads: (uploadsRes.data ?? []).map((u: unknown) => toCamel(u)),
      highRiskCompanies: highRisk.slice(0, 5).map(c => ({
        id: c.id, companyName: c.companyName, riskScore: c.riskScore ? Number(c.riskScore) : 0,
        openFlagsCount: c.openFlagsCount ?? 0, estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : 0,
      })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
