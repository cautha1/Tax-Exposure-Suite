import { Router, type IRouter } from "express";
import { db, taxRiskFlagsTable, companiesTable } from "../lib/db.js";
import { eq, and, gte, lte, ilike, or, count } from "drizzle-orm";

const router: IRouter = Router();

const fmtRisk = (r: typeof taxRiskFlagsTable.$inferSelect, companyName?: string) => ({
  id: r.id, companyId: r.companyId, transactionId: r.transactionId ?? null,
  ruleCode: r.ruleCode ?? null, riskType: r.riskType ?? null,
  description: r.description ?? null, severity: r.severity ?? null,
  estimatedExposure: r.estimatedExposure ? Number(r.estimatedExposure) : null,
  status: r.status ?? null, category: r.category ?? null,
  reviewedAt: r.reviewedAt ?? null, reviewedBy: r.reviewedBy ?? null,
  reviewNotes: r.reviewNotes ?? null,
  companyName: companyName ?? null, createdAt: r.createdAt,
});

router.get("/risks", async (req, res) => {
  try {
    const {
      companyId, severity, status, riskType, category,
      search, dateFrom, dateTo, page = "1", limit = "50",
    } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (companyId) conditions.push(eq(taxRiskFlagsTable.companyId, companyId));
    if (severity) conditions.push(eq(taxRiskFlagsTable.severity, severity));
    if (status) conditions.push(eq(taxRiskFlagsTable.status, status));
    if (riskType) conditions.push(eq(taxRiskFlagsTable.riskType, riskType));
    if (category) conditions.push(eq(taxRiskFlagsTable.category, category));
    if (search) {
      conditions.push(or(
        ilike(taxRiskFlagsTable.description, `%${search}%`),
        ilike(taxRiskFlagsTable.ruleCode, `%${search}%`),
      ));
    }
    if (dateFrom) conditions.push(gte(taxRiskFlagsTable.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(taxRiskFlagsTable.createdAt, new Date(dateTo)));

    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = await db.select({ total: count() }).from(taxRiskFlagsTable).where(where);
    const rows = await db.select().from(taxRiskFlagsTable).where(where)
      .orderBy(taxRiskFlagsTable.createdAt).limit(limitNum).offset(offset);

    const companies = await db.select({ id: companiesTable.id, name: companiesTable.companyName }).from(companiesTable);
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));

    res.json({ data: rows.map(r => fmtRisk(r, companyMap[r.companyId])), total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/risks/:id/review", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { reviewNotes } = req.body;
    const [risk] = await db.update(taxRiskFlagsTable).set({
      status: "reviewed",
      reviewedAt: new Date(),
      reviewedBy: userId ?? null,
      reviewNotes: reviewNotes ?? null,
      updatedAt: new Date(),
    }).where(eq(taxRiskFlagsTable.id, req.params.id)).returning();
    if (!risk) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, risk: fmtRisk(risk) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/risks/:id/resolve", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { reviewNotes } = req.body;
    const [risk] = await db.update(taxRiskFlagsTable).set({
      status: "resolved",
      reviewedAt: new Date(),
      reviewedBy: userId ?? null,
      reviewNotes: reviewNotes ?? null,
      updatedAt: new Date(),
    }).where(eq(taxRiskFlagsTable.id, req.params.id)).returning();
    if (!risk) { res.status(404).json({ error: "Not found" }); return; }

    const [co] = await db.select({ ofc: companiesTable.openFlagsCount }).from(companiesTable).where(eq(companiesTable.id, risk.companyId)).limit(1);
    if (co) {
      await db.update(companiesTable).set({ openFlagsCount: Math.max((co.ofc ?? 1) - 1, 0), updatedAt: new Date() }).where(eq(companiesTable.id, risk.companyId));
    }
    res.json({ success: true, risk: fmtRisk(risk) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
