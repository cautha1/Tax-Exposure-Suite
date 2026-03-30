import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  transactionsTable,
  taxRiskFlagsTable,
  uploadsTable,
  reportsTable,
} from "@workspace/db/schema";
import { eq, ilike, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/companies", async (req, res) => {
  try {
    const { search, industry, riskLevel } = req.query as Record<string, string>;
    const conditions = [];
    if (search) conditions.push(ilike(companiesTable.companyName, `%${search}%`));
    if (industry) conditions.push(eq(companiesTable.industry, industry));
    if (riskLevel) conditions.push(eq(companiesTable.riskLevel, riskLevel));
    const rows = conditions.length
      ? await db.select().from(companiesTable).where(and(...conditions)).orderBy(companiesTable.createdAt)
      : await db.select().from(companiesTable).orderBy(companiesTable.createdAt);
    res.json(rows.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      tinOrTaxId: c.tinOrTaxId ?? null,
      industry: c.industry ?? null,
      country: c.country ?? null,
      financialYear: c.financialYear ?? null,
      riskLevel: c.riskLevel ?? null,
      riskScore: c.riskScore ? Number(c.riskScore) : null,
      transactionCount: c.transactionCount ?? null,
      openFlagsCount: c.openFlagsCount ?? null,
      estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : null,
      createdAt: c.createdAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const { companyName, tinOrTaxId, industry, country, financialYear } = req.body;
    if (!companyName) {
      res.status(400).json({ error: "companyName is required" });
      return;
    }
    const inserted = await db.insert(companiesTable).values({
      companyName,
      tinOrTaxId: tinOrTaxId || null,
      industry: industry || null,
      country: country || null,
      financialYear: financialYear || null,
      riskLevel: "low",
      riskScore: "0",
    }).returning();
    const c = inserted[0];
    res.status(201).json({
      id: c.id,
      companyName: c.companyName,
      tinOrTaxId: c.tinOrTaxId ?? null,
      industry: c.industry ?? null,
      country: c.country ?? null,
      financialYear: c.financialYear ?? null,
      riskLevel: c.riskLevel ?? null,
      riskScore: c.riskScore ? Number(c.riskScore) : null,
      transactionCount: c.transactionCount ?? null,
      openFlagsCount: c.openFlagsCount ?? null,
      estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : null,
      createdAt: c.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const rows = await db.select().from(companiesTable).where(eq(companiesTable.id, req.params.id)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const c = rows[0];
    res.json({
      id: c.id,
      companyName: c.companyName,
      tinOrTaxId: c.tinOrTaxId ?? null,
      industry: c.industry ?? null,
      country: c.country ?? null,
      financialYear: c.financialYear ?? null,
      riskLevel: c.riskLevel ?? null,
      riskScore: c.riskScore ? Number(c.riskScore) : null,
      transactionCount: c.transactionCount ?? null,
      openFlagsCount: c.openFlagsCount ?? null,
      estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : null,
      createdAt: c.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/companies/:id", async (req, res) => {
  try {
    const { companyName, tinOrTaxId, industry, country, financialYear } = req.body;
    const updated = await db.update(companiesTable)
      .set({ companyName, tinOrTaxId, industry, country, financialYear, updatedAt: new Date() })
      .where(eq(companiesTable.id, req.params.id))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    const c = updated[0];
    res.json({
      id: c.id,
      companyName: c.companyName,
      tinOrTaxId: c.tinOrTaxId ?? null,
      industry: c.industry ?? null,
      country: c.country ?? null,
      financialYear: c.financialYear ?? null,
      riskLevel: c.riskLevel ?? null,
      riskScore: c.riskScore ? Number(c.riskScore) : null,
      transactionCount: c.transactionCount ?? null,
      openFlagsCount: c.openFlagsCount ?? null,
      estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : null,
      createdAt: c.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/companies/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;
    const [txResult, riskResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable).where(eq(transactionsTable.companyId, id)),
      db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.companyId, id)),
    ]);
    const totalTransactions = Number(txResult[0]?.count ?? 0);
    const openRisks = riskResult.filter((r) => r.status === "open").length;
    const estimatedExposure = riskResult
      .filter((r) => r.status === "open")
      .reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const riskScore = Math.min(100, Math.round((openRisks / Math.max(totalTransactions, 1)) * 1000));
    let riskLevel = "low";
    if (riskScore > 60) riskLevel = "high";
    else if (riskScore > 30) riskLevel = "medium";

    const categoryMap: Record<string, { count: number; exposure: number }> = {};
    const severityMap: Record<string, number> = {};
    for (const r of riskResult) {
      const cat = r.category ?? "Other";
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, exposure: 0 };
      categoryMap[cat].count++;
      categoryMap[cat].exposure += Number(r.estimatedExposure ?? 0);
      const sev = r.severity ?? "low";
      severityMap[sev] = (severityMap[sev] ?? 0) + 1;
    }
    const risksByCategory = Object.entries(categoryMap).map(([category, v]) => ({
      category,
      count: v.count,
      exposure: v.exposure,
    }));
    const severityBreakdown = Object.entries(severityMap).map(([severity, count]) => ({ severity, count }));

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyExposure = months.map((m) => ({ month: m, exposure: Math.random() * 50000 }));

    res.json({
      totalTransactions,
      openRisks,
      estimatedExposure,
      riskScore,
      riskLevel,
      risksByCategory,
      severityBreakdown,
      monthlyExposure,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
