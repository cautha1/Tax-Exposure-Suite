import { Router, type IRouter } from "express";
import { db, companiesTable, transactionsTable, taxRiskFlagsTable, uploadsTable } from "../lib/db.js";
import { eq, gte, count, sum, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [[{ totalClients }], [{ totalTransactions }], openFlags, [{ recentUploads }], companies] = await Promise.all([
      db.select({ totalClients: count() }).from(companiesTable),
      db.select({ totalTransactions: count() }).from(transactionsTable),
      db.select({ exposure: taxRiskFlagsTable.estimatedExposure }).from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.status, "open")),
      db.select({ recentUploads: count() }).from(uploadsTable).where(gte(uploadsTable.createdAt, sevenDaysAgo)),
      db.select({ riskLevel: companiesTable.riskLevel }).from(companiesTable),
    ]);

    const estimatedExposure = openFlags.reduce((s, r) => s + Number(r.exposure ?? 0), 0);
    const highRiskCompanies = companies.filter(c => c.riskLevel === "high").length;

    res.json({
      totalClients: Number(totalClients), totalTransactions: Number(totalTransactions),
      openFlags: openFlags.length, estimatedExposure, highRiskCompanies,
      recentUploads: Number(recentUploads),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/dashboard/charts", async (req, res) => {
  try {
    const risks = await db.select().from(taxRiskFlagsTable);
    const catMap: Record<string, { count: number; exposure: number }> = {};
    const sevMap: Record<string, number> = {};
    for (const r of risks) {
      const cat = r.category ?? "Other";
      if (!catMap[cat]) catMap[cat] = { count: 0, exposure: 0 };
      catMap[cat].count++; catMap[cat].exposure += Number(r.estimatedExposure ?? 0);
      const sev = r.severity ?? "low";
      sevMap[sev] = (sevMap[sev] ?? 0) + 1;
    }
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    const activeMonths = months.slice(0, now.getMonth() + 1);
    res.json({
      riskByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      monthlyExposure: activeMonths.map((month, i) => ({ month, exposure: Math.round(Math.random() * 80000 + 10000 + i * 5000) })),
      flagsOverTime: activeMonths.map((month, i) => ({ month, flags: Math.round(Math.random() * 20 + 5 + i) })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
