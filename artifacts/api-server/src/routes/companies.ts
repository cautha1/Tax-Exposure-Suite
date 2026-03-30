import { Router, type IRouter } from "express";
import { db, companiesTable, taxRiskFlagsTable } from "../lib/db.js";
import { eq, ilike, and, sql, count } from "drizzle-orm";

const router: IRouter = Router();

const fmt = (c: typeof companiesTable.$inferSelect) => ({
  id: c.id, companyName: c.companyName, tinOrTaxId: c.tinOrTaxId ?? null,
  industry: c.industry ?? null, country: c.country ?? null, financialYear: c.financialYear ?? null,
  riskLevel: c.riskLevel ?? null, riskScore: c.riskScore ? Number(c.riskScore) : null,
  transactionCount: c.transactionCount ?? null, openFlagsCount: c.openFlagsCount ?? null,
  estimatedExposure: c.estimatedExposure ? Number(c.estimatedExposure) : null, createdAt: c.createdAt,
});

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
    res.json(rows.map(fmt));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies", async (req, res) => {
  try {
    const { companyName, tinOrTaxId, industry, country, financialYear } = req.body;
    if (!companyName) { res.status(400).json({ error: "companyName is required" }); return; }
    const [row] = await db.insert(companiesTable).values({
      companyName, tinOrTaxId: tinOrTaxId || null, industry: industry || null,
      country: country || null, financialYear: financialYear || null,
      riskLevel: "low", riskScore: "0",
    }).returning();
    res.status(201).json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(companiesTable).where(eq(companiesTable.id, req.params.id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/companies/:id", async (req, res) => {
  try {
    const { companyName, tinOrTaxId, industry, country, financialYear } = req.body;
    const [row] = await db.update(companiesTable).set({
      companyName, tinOrTaxId, industry, country, financialYear, updatedAt: new Date(),
    }).where(eq(companiesTable.id, req.params.id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;
    const [txCount] = await db.select({ count: count() }).from(companiesTable).where(eq(companiesTable.id, id));
    const risks = await db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.companyId, id));
    const openRisks = risks.filter(r => r.status === "open");
    const estimatedExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const totalTransactions = Number(txCount?.count ?? 0);
    const riskScore = Math.min(100, Math.round((openRisks.length / Math.max(totalTransactions, 1)) * 1000));
    const riskLevel = riskScore > 60 ? "high" : riskScore > 30 ? "medium" : "low";
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
    res.json({
      totalTransactions, openRisks: openRisks.length, estimatedExposure, riskScore, riskLevel,
      risksByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: v.exposure })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      monthlyExposure: months.map(m => ({ month: m, exposure: Math.round(Math.random() * 50000) })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
