import { Router, type IRouter } from "express";
import { db, reportsTable, companiesTable, taxRiskFlagsTable } from "../lib/db.js";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const fmtReport = (r: typeof reportsTable.$inferSelect, companyName?: string) => ({
  id: r.id, companyId: r.companyId, title: r.title ?? null, status: r.status ?? null,
  summary: r.summary ?? null, totalExposure: r.totalExposure ? Number(r.totalExposure) : null,
  highRisks: r.highRisks ?? null, mediumRisks: r.mediumRisks ?? null, lowRisks: r.lowRisks ?? null,
  companyName: companyName ?? null, createdAt: r.createdAt,
});

router.get("/reports", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    const rows = companyId
      ? await db.select().from(reportsTable).where(eq(reportsTable.companyId, companyId)).orderBy(desc(reportsTable.createdAt))
      : await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
    const companies = await db.select({ id: companiesTable.id, name: companiesTable.companyName }).from(companiesTable);
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));
    res.json(rows.map(r => fmtReport(r, companyMap[r.companyId])));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/reports", async (req, res) => {
  try {
    const { companyId, title } = req.body;
    if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }
    const risks = await db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.companyId, companyId));
    const openRisks = risks.filter(r => r.status === "open");
    const highRisks = openRisks.filter(r => r.severity === "high").length;
    const mediumRisks = openRisks.filter(r => r.severity === "medium").length;
    const lowRisks = openRisks.filter(r => r.severity === "low").length;
    const totalExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const reportTitle = title || `Tax Exposure Report - ${company.companyName} - ${new Date().toLocaleDateString()}`;
    const summary = `Analysis for ${company.companyName}. Found ${openRisks.length} open risk flags with estimated total exposure of $${totalExposure.toLocaleString()}. High: ${highRisks}, Medium: ${mediumRisks}, Low: ${lowRisks}.`;
    const [row] = await db.insert(reportsTable).values({
      companyId, title: reportTitle, status: "ready", summary,
      totalExposure: String(totalExposure), highRisks, mediumRisks, lowRisks,
    }).returning();
    res.status(201).json(fmtReport(row, company.companyName));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/reports/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(reportsTable).where(eq(reportsTable.id, req.params.id)).limit(1);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const [co] = await db.select({ name: companiesTable.companyName }).from(companiesTable).where(eq(companiesTable.id, row.companyId)).limit(1);
    res.json(fmtReport(row, co?.name));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
