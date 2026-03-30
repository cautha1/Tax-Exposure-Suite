import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { taxRiskFlagsTable, companiesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

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

    const [rows, totalResult, companies] = await Promise.all([
      db.select().from(taxRiskFlagsTable).where(where).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(taxRiskFlagsTable).where(where),
      db.select({ id: companiesTable.id, name: companiesTable.companyName }).from(companiesTable),
    ]);

    const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

    res.json({
      data: rows.map((r) => ({
        id: r.id,
        companyId: r.companyId,
        transactionId: r.transactionId ?? null,
        ruleCode: r.ruleCode ?? null,
        description: r.description ?? null,
        severity: r.severity ?? null,
        estimatedExposure: r.estimatedExposure ? Number(r.estimatedExposure) : null,
        status: r.status ?? null,
        category: r.category ?? null,
        companyName: companyMap[r.companyId] ?? null,
        createdAt: r.createdAt,
      })),
      total: Number(totalResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/risks/:id/resolve", async (req, res) => {
  try {
    const updated = await db.update(taxRiskFlagsTable)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(eq(taxRiskFlagsTable.id, req.params.id))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }

    const risk = updated[0];
    await db.update(companiesTable)
      .set({ openFlagsCount: sql`GREATEST(open_flags_count - 1, 0)` })
      .where(eq(companiesTable.id, risk.companyId));

    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
