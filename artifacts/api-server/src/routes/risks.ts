import { Router, type IRouter } from "express";
import { db, taxRiskFlagsTable, companiesTable } from "../lib/db.js";
import { eq, and, count } from "drizzle-orm";

const router: IRouter = Router();

const fmtRisk = (r: typeof taxRiskFlagsTable.$inferSelect, companyName?: string) => ({
  id: r.id, companyId: r.companyId, transactionId: r.transactionId ?? null,
  ruleCode: r.ruleCode ?? null, description: r.description ?? null,
  severity: r.severity ?? null, estimatedExposure: r.estimatedExposure ? Number(r.estimatedExposure) : null,
  status: r.status ?? null, category: r.category ?? null,
  companyName: companyName ?? null, createdAt: r.createdAt,
});

router.get("/risks", async (req, res) => {
  try {
    const { companyId, severity, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;
    const conditions = [];
    if (companyId) conditions.push(eq(taxRiskFlagsTable.companyId, companyId));
    if (severity) conditions.push(eq(taxRiskFlagsTable.severity, severity));
    if (status) conditions.push(eq(taxRiskFlagsTable.status, status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = await db.select({ total: count() }).from(taxRiskFlagsTable).where(where);
    const rows = await db.select().from(taxRiskFlagsTable).where(where).limit(limitNum).offset(offset).orderBy(taxRiskFlagsTable.createdAt);
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.companyName }).from(companiesTable);
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));
    res.json({ data: rows.map(r => fmtRisk(r, companyMap[r.companyId])), total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/risks/:id/resolve", async (req, res) => {
  try {
    const [risk] = await db.update(taxRiskFlagsTable).set({ status: "resolved", updatedAt: new Date() }).where(eq(taxRiskFlagsTable.id, req.params.id)).returning();
    if (!risk) { res.status(404).json({ error: "Not found" }); return; }
    const [co] = await db.select({ ofc: companiesTable.openFlagsCount }).from(companiesTable).where(eq(companiesTable.id, risk.companyId)).limit(1);
    if (co) {
      await db.update(companiesTable).set({ openFlagsCount: Math.max((co.ofc ?? 1) - 1, 0), updatedAt: new Date() }).where(eq(companiesTable.id, risk.companyId));
    }
    res.json({ success: true });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
