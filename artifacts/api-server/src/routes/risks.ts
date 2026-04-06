import { Router, type IRouter } from "express";
import { db, taxRiskFlagsTable, companiesTable, transactionsTable } from "../lib/db.js";
import { eq, and, gte, lte, ilike, or, count } from "drizzle-orm";

const router: IRouter = Router();

type RiskRow = typeof taxRiskFlagsTable.$inferSelect;

const fmtRisk = (r: RiskRow, companyName?: string, transaction?: Record<string, unknown>) => ({
  id: r.id,
  companyId: r.companyId,
  transactionId: r.transactionId ?? null,
  ruleCode: r.ruleCode ?? null,
  riskType: r.riskType ?? null,
  description: r.description ?? null,
  severity: r.severity ?? null,
  estimatedExposure: r.estimatedExposure != null ? Number(r.estimatedExposure) : null,
  status: r.status ?? null,
  category: r.category ?? null,
  confidence: r.confidence ?? null,
  riskScore: r.riskScore != null ? Number(r.riskScore) : null,
  reviewedAt: r.reviewedAt ?? null,
  reviewedBy: r.reviewedBy ?? null,
  reviewNotes: r.reviewNotes ?? null,
  resolvedBy: r.resolvedBy ?? null,
  resolvedAt: r.resolvedAt ?? null,
  internalNote: r.internalNote ?? null,
  companyName: companyName ?? null,
  transaction: transaction ?? null,
  createdAt: r.createdAt,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/risks/summary", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    if (companyId && !UUID_RE.test(companyId)) {
      res.json({ openCount: 0, reviewedCount: 0, resolvedCount: 0, totalExposure: 0 });
      return;
    }
    const conditions = [];
    if (companyId) conditions.push(eq(taxRiskFlagsTable.companyId, companyId));
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db.select({
      status: taxRiskFlagsTable.status,
      exposure: taxRiskFlagsTable.estimatedExposure,
    }).from(taxRiskFlagsTable).where(where);

    let openCount = 0, reviewedCount = 0, resolvedCount = 0, totalExposure = 0;
    for (const r of rows) {
      totalExposure += Number(r.exposure ?? 0);
      if (r.status === "open") openCount++;
      else if (r.status === "reviewed") reviewedCount++;
      else if (r.status === "resolved") resolvedCount++;
    }

    res.json({ openCount, reviewedCount, resolvedCount, totalExposure });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
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

router.get("/risks/:id", async (req, res) => {
  try {
    const [risk] = await db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.id, req.params.id)).limit(1);
    if (!risk) { res.status(404).json({ error: "Not found" }); return; }

    const [companyRow] = await db.select({
      id: companiesTable.id,
      companyName: companiesTable.companyName,
      industry: companiesTable.industry,
      country: companiesTable.country,
      riskLevel: companiesTable.riskLevel,
      riskScore: companiesTable.riskScore,
    }).from(companiesTable).where(eq(companiesTable.id, risk.companyId)).limit(1);

    let transaction: Record<string, unknown> | undefined;
    if (risk.transactionId) {
      const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, risk.transactionId)).limit(1);
      if (tx) transaction = tx as unknown as Record<string, unknown>;
    }

    const company = companyRow
      ? {
          id: companyRow.id,
          companyName: companyRow.companyName,
          industry: companyRow.industry ?? null,
          country: companyRow.country ?? null,
          riskLevel: companyRow.riskLevel ?? null,
          riskScore: companyRow.riskScore != null ? Number(companyRow.riskScore) : null,
        }
      : null;

    res.json({ ...fmtRisk(risk, companyRow?.companyName, transaction), company });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/risks/:id/review", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string | undefined;
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
    const userId = req.headers["x-user-id"] as string | undefined;
    const { reviewNotes } = req.body;
    const [risk] = await db.update(taxRiskFlagsTable).set({
      status: "resolved",
      resolvedAt: new Date(),
      resolvedBy: userId ?? null,
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

router.patch("/risks/:id/note", async (req, res) => {
  try {
    const { note } = req.body;
    if (typeof note !== "string") { res.status(400).json({ error: "note (string) is required" }); return; }
    const [risk] = await db.update(taxRiskFlagsTable).set({
      internalNote: note,
      updatedAt: new Date(),
    }).where(eq(taxRiskFlagsTable.id, req.params.id)).returning();
    if (!risk) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, risk: fmtRisk(risk) });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
