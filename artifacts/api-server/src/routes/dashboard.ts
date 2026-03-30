import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  transactionsTable,
  taxRiskFlagsTable,
  uploadsTable,
} from "@workspace/db/schema";
import { eq, sql, gte } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalClients, totalTransactions, openFlags, recentUploads, companies] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(companiesTable),
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable),
      db.select({ count: sql<number>`count(*)`, exposure: sql<number>`coalesce(sum(estimated_exposure::numeric), 0)` })
        .from(taxRiskFlagsTable)
        .where(eq(taxRiskFlagsTable.status, "open")),
      db.select({ count: sql<number>`count(*)` }).from(uploadsTable).where(gte(uploadsTable.createdAt, sevenDaysAgo)),
      db.select({ riskLevel: companiesTable.riskLevel }).from(companiesTable),
    ]);

    const highRiskCompanies = companies.filter((c) => c.riskLevel === "high").length;

    res.json({
      totalClients: Number(totalClients[0]?.count ?? 0),
      totalTransactions: Number(totalTransactions[0]?.count ?? 0),
      openFlags: Number(openFlags[0]?.count ?? 0),
      estimatedExposure: Number(openFlags[0]?.exposure ?? 0),
      highRiskCompanies,
      recentUploads: Number(recentUploads[0]?.count ?? 0),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/charts", async (req, res) => {
  try {
    const risks = await db.select().from(taxRiskFlagsTable);

    const categoryMap: Record<string, { count: number; exposure: number }> = {};
    const severityMap: Record<string, number> = {};
    for (const r of risks) {
      const cat = r.category ?? "Other";
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, exposure: 0 };
      categoryMap[cat].count++;
      categoryMap[cat].exposure += Number(r.estimatedExposure ?? 0);
      const sev = r.severity ?? "low";
      severityMap[sev] = (severityMap[sev] ?? 0) + 1;
    }
    const riskByCategory = Object.entries(categoryMap).map(([category, v]) => ({
      category,
      count: v.count,
      exposure: Math.round(v.exposure),
    }));
    const severityBreakdown = Object.entries(severityMap).map(([severity, count]) => ({ severity, count }));

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const monthlyExposure = months.slice(0, now.getMonth() + 1).map((month, i) => ({
      month,
      exposure: Math.round(Math.random() * 80000 + 10000 + i * 5000),
    }));
    const flagsOverTime = months.slice(0, now.getMonth() + 1).map((month, i) => ({
      month,
      flags: Math.round(Math.random() * 20 + 5 + i),
    }));

    res.json({ riskByCategory, severityBreakdown, monthlyExposure, flagsOverTime });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
