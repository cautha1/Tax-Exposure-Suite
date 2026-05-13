import { Router, type IRouter } from "express";
import { supabase, toCamel } from "../lib/supabase.js";
import {
  currentUser,
  getVisibleCompanyIds,
  requireCompanyAccess,
} from "../lib/access.js";

const router: IRouter = Router();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ChartRisk {
  category: string | null;
  severity: string | null;
  riskType: string | null;
  estimatedExposure: string | number | null;
  createdAt: string | null;
}

function monthlySeries(
  rows: ChartRisk[],
  valueForRow: (row: ChartRisk) => number,
  valueKey: "exposure" | "flags",
) {
  const now = new Date();
  const buckets = Array.from({ length: now.getMonth() + 1 }, () => 0);

  for (const row of rows) {
    if (!row.createdAt) continue;
    const createdAt = new Date(row.createdAt);
    if (
      Number.isNaN(createdAt.getTime()) ||
      createdAt.getFullYear() !== now.getFullYear()
    ) continue;

    buckets[createdAt.getMonth()] += valueForRow(row);
  }

  return buckets.map((value, index) => ({
    month: MONTHS[index],
    [valueKey]: Math.round(value),
  }));
}

function emptyStats() {
  return {
    totalClients: 0,
    totalTransactions: 0,
    openFlags: 0,
    estimatedExposure: 0,
    highRiskCompanies: 0,
    recentUploads: 0,
  };
}

function emptyAdvisorDashboard() {
  return {
    totalClients: 0,
    totalTransactions: 0,
    totalOpenFlags: 0,
    estimatedExposure: 0,
    highRiskClients: 0,
    riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
    recentAlerts: [],
    recentUploads: [],
    highRiskCompanies: [],
    workflowCounts: { open: 0, reviewed: 0, resolved: 0 },
    recentActivity: [],
    reviewBacklog: [],
  };
}

router.get("/dashboard/stats", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;

  try {
    const visibleCompanyIds = await getVisibleCompanyIds(user);
    if (visibleCompanyIds && visibleCompanyIds.length === 0) {
      res.json(emptyStats());
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let companiesCountQ = supabase.from("companies").select("id", { count: "exact", head: true });
    let transactionsQ = supabase.from("transactions").select("id", { count: "exact", head: true });
    let openFlagsQ = supabase.from("tax_risk_flags").select("estimated_exposure, severity").eq("status", "open");
    let uploadsQ = supabase.from("uploads").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString());
    let companiesRiskQ = supabase.from("companies").select("risk_level");

    if (visibleCompanyIds) {
      companiesCountQ = companiesCountQ.in("id", visibleCompanyIds);
      transactionsQ = transactionsQ.in("company_id", visibleCompanyIds);
      openFlagsQ = openFlagsQ.in("company_id", visibleCompanyIds);
      uploadsQ = uploadsQ.in("company_id", visibleCompanyIds);
      companiesRiskQ = companiesRiskQ.in("id", visibleCompanyIds);
    }

    const [companiesRes, transactionsRes, openFlagsRes, uploadsRes, companiesRiskRes] = await Promise.all([
      companiesCountQ,
      transactionsQ,
      openFlagsQ,
      uploadsQ,
      companiesRiskQ,
    ]);

    const companies = (companiesRiskRes.data ?? []).map((c: unknown) => toCamel<{ riskLevel: string }>(c));
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
  const user = currentUser(req, res);
  if (!user) return;

  try {
    const visibleCompanyIds = await getVisibleCompanyIds(user);
    if (visibleCompanyIds && visibleCompanyIds.length === 0) {
      res.json({
        riskByCategory: [],
        severityBreakdown: [],
        riskTypeBreakdown: [],
        monthlyExposure: monthlySeries([], () => 0, "exposure"),
        flagsOverTime: monthlySeries([], () => 0, "flags"),
      });
      return;
    }

    let risksQ = supabase
      .from("tax_risk_flags")
      .select("category, severity, risk_type, estimated_exposure, created_at");
    if (visibleCompanyIds) risksQ = risksQ.in("company_id", visibleCompanyIds);

    const { data: risksRaw } = await risksQ;
    const risks = (risksRaw ?? []).map((r: unknown) => toCamel<ChartRisk>(r));

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

    res.json({
      riskByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      riskTypeBreakdown: Object.entries(typeMap).map(([riskType, count]) => ({ riskType, count })),
      monthlyExposure: monthlySeries(risks, row => Number(row.estimatedExposure ?? 0), "exposure"),
      flagsOverTime: monthlySeries(risks, () => 1, "flags"),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/company/:companyId", async (req, res) => {
  if (!(await requireCompanyAccess(req, res, req.params.companyId))) return;

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
  const user = currentUser(req, res);
  if (!user) return;

  try {
    const visibleCompanyIds = await getVisibleCompanyIds(user);
    if (visibleCompanyIds && visibleCompanyIds.length === 0) {
      res.json(emptyAdvisorDashboard());
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let companiesQ = supabase.from("companies").select("*").order("updated_at", { ascending: false });
    let flagsQ = supabase.from("tax_risk_flags").select("*");
    let txQ = supabase.from("transactions").select("id", { count: "exact", head: true });
    let uploadsQ = supabase.from("uploads").select("*").gte("created_at", sevenDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(10);
    let activityQ = supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(10);

    if (visibleCompanyIds) {
      companiesQ = companiesQ.in("id", visibleCompanyIds);
      flagsQ = flagsQ.in("company_id", visibleCompanyIds);
      txQ = txQ.in("company_id", visibleCompanyIds);
      uploadsQ = uploadsQ.in("company_id", visibleCompanyIds);
      activityQ = activityQ.in("company_id", visibleCompanyIds);
    }

    const [companiesRes, flagsRes, txRes, uploadsRes, activityRes] = await Promise.all([
      companiesQ,
      flagsQ,
      txQ,
      uploadsQ,
      activityQ,
    ]);

    interface CompanyRow { id: string; companyName: string; riskLevel: string; riskScore: string; openFlagsCount: number; estimatedExposure: string; }
    interface FlagRow { id: string; companyId: string; description: string; severity: string; category: string; estimatedExposure: string; status: string; createdAt: string; }
    interface ActivityRow { id: string; companyId: string | null; action: string; entityType: string; entityId: string | null; metadata: Record<string, unknown>; createdAt: string; }

    const allCompanies = (companiesRes.data ?? []).map((c: unknown) => toCamel<CompanyRow>(c));
    const allFlags = (flagsRes.data ?? []).map((f: unknown) => toCamel<FlagRow>(f));
    const openFlags = allFlags.filter(f => f.status === "open");

    const estimatedExposure = openFlags.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const highRisk = allCompanies.filter(c => c.riskLevel === "high" || c.riskLevel === "critical");
    const companyMap = Object.fromEntries(allCompanies.map(c => [c.id, c.companyName]));

    const recentAlerts = openFlags
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map(r => ({ id: r.id, companyId: r.companyId, companyName: companyMap[r.companyId] ?? null, description: r.description, severity: r.severity, category: r.category, createdAt: r.createdAt }));

    res.json({
      totalClients: allCompanies.length,
      totalTransactions: txRes.count ?? 0,
      totalOpenFlags: openFlags.length,
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
      workflowCounts: {
        open: openFlags.length,
        reviewed: allFlags.filter(f => f.status === "reviewed").length,
        resolved: allFlags.filter(f => f.status === "resolved").length,
      },
      reviewBacklog: allFlags
        .filter(f => f.status === "reviewed")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, 5)
        .map(r => ({ id: r.id, companyId: r.companyId, companyName: companyMap[r.companyId] ?? null, description: r.description, severity: r.severity, category: r.category, createdAt: r.createdAt })),
      recentActivity: (activityRes.data ?? []).map((a: unknown) => {
        const row = toCamel<ActivityRow>(a);
        return { ...row, companyName: row.companyId ? companyMap[row.companyId] ?? null : null };
      }),
      highRiskCompanies: highRisk.slice(0, 5).map(c => ({
        id: c.id, companyName: c.companyName, riskScore: c.riskScore ? Number(c.riskScore) : 0,
        openFlagsCount: c.openFlagsCount ?? 0, estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : 0,
      })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
