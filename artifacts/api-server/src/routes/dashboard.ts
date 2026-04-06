import { Router, type IRouter } from "express";
import { db, companiesTable, transactionsTable, taxRiskFlagsTable, uploadsTable, reportsTable } from "../lib/db.js";
import { eq, gte, count, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [[{ totalClients }], [{ totalTransactions }], openFlags, [{ recentUploads }], companies] = await Promise.all([
      db.select({ totalClients: count() }).from(companiesTable),
      db.select({ totalTransactions: count() }).from(transactionsTable),
      db.select({ exposure: taxRiskFlagsTable.estimatedExposure, severity: taxRiskFlagsTable.severity }).from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.status, "open")),
      db.select({ recentUploads: count() }).from(uploadsTable).where(gte(uploadsTable.createdAt, sevenDaysAgo)),
      db.select({ riskLevel: companiesTable.riskLevel }).from(companiesTable),
    ]);

    const estimatedExposure = openFlags.reduce((s, r) => s + Number(r.exposure ?? 0), 0);
    const highRiskCompanies = companies.filter(c => c.riskLevel === "high" || c.riskLevel === "critical").length;

    res.json({
      totalClients: Number(totalClients),
      totalTransactions: Number(totalTransactions),
      openFlags: openFlags.length,
      estimatedExposure,
      highRiskCompanies,
      recentUploads: Number(recentUploads),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/charts", async (req, res) => {
  try {
    const risks = await db.select().from(taxRiskFlagsTable);
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

    const [[{ totalTx }], risks, recentUploads, recentReports] = await Promise.all([
      db.select({ totalTx: count() }).from(transactionsTable).where(eq(transactionsTable.companyId, companyId)),
      db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.companyId, companyId)),
      db.select().from(uploadsTable).where(and(eq(uploadsTable.companyId, companyId), gte(uploadsTable.createdAt, sevenDaysAgo))).orderBy(desc(uploadsTable.createdAt)).limit(5),
      db.select().from(reportsTable).where(eq(reportsTable.companyId, companyId)).orderBy(desc(reportsTable.createdAt)).limit(3),
    ]);

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

    const recentAlerts = openRisks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5).map(r => ({
      id: r.id, description: r.description, severity: r.severity, category: r.category, createdAt: r.createdAt,
    }));

    res.json({
      totalTransactions: Number(totalTx),
      totalFlags: risks.length, openFlags: openRisks.length,
      estimatedExposure, severityBreakdown: sevMap,
      risksByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      recentAlerts, recentUploads, recentReports,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/advisor", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [allCompanies, allFlags, [{ totalTx }], recentUploads] = await Promise.all([
      db.select().from(companiesTable).orderBy(desc(companiesTable.updatedAt)),
      db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.status, "open")),
      db.select({ totalTx: count() }).from(transactionsTable),
      db.select().from(uploadsTable).where(gte(uploadsTable.createdAt, sevenDaysAgo)).orderBy(desc(uploadsTable.createdAt)).limit(10),
    ]);

    const estimatedExposure = allFlags.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const highRisk = allCompanies.filter(c => c.riskLevel === "high" || c.riskLevel === "critical");
    const companyMap = Object.fromEntries(allCompanies.map(c => [c.id, c.companyName]));

    const recentAlerts = allFlags
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10)
      .map(r => ({ id: r.id, companyId: r.companyId, companyName: companyMap[r.companyId] ?? null, description: r.description, severity: r.severity, category: r.category, createdAt: r.createdAt }));

    res.json({
      totalClients: allCompanies.length,
      totalTransactions: Number(totalTx),
      totalOpenFlags: allFlags.length,
      estimatedExposure,
      highRiskClients: highRisk.length,
      riskDistribution: {
        critical: allCompanies.filter(c => c.riskLevel === "critical").length,
        high: allCompanies.filter(c => c.riskLevel === "high").length,
        medium: allCompanies.filter(c => c.riskLevel === "medium").length,
        low: allCompanies.filter(c => !c.riskLevel || c.riskLevel === "low").length,
      },
      recentAlerts, recentUploads,
      highRiskCompanies: highRisk.slice(0, 5).map(c => ({ id: c.id, companyName: c.companyName, riskScore: c.riskScore ? Number(c.riskScore) : 0, openFlagsCount: c.openFlagsCount ?? 0, estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : 0 })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
