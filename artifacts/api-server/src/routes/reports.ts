import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reportsTable, companiesTable, taxRiskFlagsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const formatReport = (r: typeof reportsTable.$inferSelect, companyName?: string) => ({
  id: r.id,
  companyId: r.companyId,
  title: r.title ?? null,
  status: r.status ?? null,
  summary: r.summary ?? null,
  totalExposure: r.totalExposure ? Number(r.totalExposure) : null,
  highRisks: r.highRisks ?? null,
  mediumRisks: r.mediumRisks ?? null,
  lowRisks: r.lowRisks ?? null,
  companyName: companyName ?? null,
  createdAt: r.createdAt,
});

router.get("/reports", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    const rows = companyId
      ? await db.select().from(reportsTable).where(eq(reportsTable.companyId, companyId)).orderBy(reportsTable.createdAt)
      : await db.select().from(reportsTable).orderBy(reportsTable.createdAt);
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.companyName }).from(companiesTable);
    const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    res.json(rows.map((r) => formatReport(r, companyMap[r.companyId])));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    const { companyId, title } = req.body;
    if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }

    const [company, risks] = await Promise.all([
      db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1),
      db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.companyId, companyId)),
    ]);
    if (!company.length) { res.status(404).json({ error: "Company not found" }); return; }

    const openRisks = risks.filter((r) => r.status === "open");
    const highRisks = openRisks.filter((r) => r.severity === "high").length;
    const mediumRisks = openRisks.filter((r) => r.severity === "medium").length;
    const lowRisks = openRisks.filter((r) => r.severity === "low").length;
    const totalExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);

    const reportTitle = title || `Tax Exposure Report - ${company[0].companyName} - ${new Date().toLocaleDateString()}`;
    const summary = `Tax exposure analysis for ${company[0].companyName}. Found ${openRisks.length} open risk flags with estimated total exposure of $${totalExposure.toLocaleString()}. High: ${highRisks}, Medium: ${mediumRisks}, Low: ${lowRisks}.`;

    const inserted = await db.insert(reportsTable).values({
      companyId,
      title: reportTitle,
      status: "ready",
      summary,
      totalExposure: totalExposure.toString(),
      highRisks,
      mediumRisks,
      lowRisks,
    }).returning();

    res.status(201).json(formatReport(inserted[0], company[0].companyName));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports/:id", async (req, res) => {
  try {
    const rows = await db.select().from(reportsTable).where(eq(reportsTable.id, req.params.id)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const company = await db.select({ name: companiesTable.companyName }).from(companiesTable).where(eq(companiesTable.id, rows[0].companyId)).limit(1);
    res.json(formatReport(rows[0], company[0]?.name));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
