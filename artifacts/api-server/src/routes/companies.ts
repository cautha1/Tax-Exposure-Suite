import { Router, type IRouter } from "express";
import { db, companiesTable, taxRiskFlagsTable, companyUsersTable, profilesTable } from "../lib/db.js";
import { eq, ilike, and, count, sql } from "drizzle-orm";

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
      ? await db.select().from(companiesTable).where(and(...conditions)).orderBy(companiesTable.companyName)
      : await db.select().from(companiesTable).orderBy(companiesTable.companyName);
    res.json(rows.map(fmt));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { companyName, tinOrTaxId, industry, country, financialYear, assignedAdvisorId } = req.body;
    if (!companyName) { res.status(400).json({ error: "companyName is required" }); return; }

    const [row] = await db.insert(companiesTable).values({
      companyName, tinOrTaxId: tinOrTaxId || null, industry: industry || null,
      country: country || null, financialYear: financialYear || null,
      riskLevel: "low", riskScore: "0",
    }).returning();

    if (assignedAdvisorId) {
      await db.insert(companyUsersTable).values({
        companyId: row.id, userId: assignedAdvisorId, role: "advisor", assignedBy: userId ?? null,
      }).onConflictDoNothing();
    }

    if (userId && userId !== assignedAdvisorId) {
      await db.insert(companyUsersTable).values({
        companyId: row.id, userId, role: "owner", assignedBy: userId,
      }).onConflictDoNothing();
    }

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
    const { companyName, tinOrTaxId, industry, country, financialYear, assignedAdvisorId } = req.body;
    const userId = req.headers["x-user-id"] as string;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (companyName !== undefined) updateData.companyName = companyName;
    if (tinOrTaxId !== undefined) updateData.tinOrTaxId = tinOrTaxId;
    if (industry !== undefined) updateData.industry = industry;
    if (country !== undefined) updateData.country = country;
    if (financialYear !== undefined) updateData.financialYear = financialYear;

    const [row] = await db.update(companiesTable).set(updateData).where(eq(companiesTable.id, req.params.id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    if (assignedAdvisorId) {
      await db.insert(companyUsersTable).values({
        companyId: row.id, userId: assignedAdvisorId, role: "advisor", assignedBy: userId ?? null,
      }).onConflictDoNothing();
    }

    res.json(fmt(row));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/users", async (req, res) => {
  try {
    const assignments = await db.select().from(companyUsersTable).where(eq(companyUsersTable.companyId, req.params.id));
    const userIds = assignments.map(a => a.userId);
    if (userIds.length === 0) { res.json([]); return; }
    const profiles = await db.select({ id: profilesTable.id, email: profilesTable.email, fullName: profilesTable.fullName, role: profilesTable.role }).from(profilesTable);
    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
    res.json(assignments.map(a => ({ ...a, user: profileMap[a.userId] ?? null })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/companies/:id/users", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { userId: targetUserId, role = "member" } = req.body;
    if (!targetUserId) { res.status(400).json({ error: "userId required" }); return; }
    const [row] = await db.insert(companyUsersTable).values({
      companyId: req.params.id, userId: targetUserId, role, assignedBy: userId ?? null,
    }).onConflictDoNothing().returning();
    res.status(201).json(row ?? { message: "User already assigned" });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/companies/:id/summary", async (req, res) => {
  try {
    const { id } = req.params;
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
    if (!company) { res.status(404).json({ error: "Not found" }); return; }
    const risks = await db.select().from(taxRiskFlagsTable).where(eq(taxRiskFlagsTable.companyId, id));
    const openRisks = risks.filter(r => r.status === "open");
    const estimatedExposure = openRisks.reduce((s, r) => s + Number(r.estimatedExposure ?? 0), 0);
    const riskScore = company.riskScore ? Number(company.riskScore) : 0;
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
      totalTransactions: company.transactionCount ?? 0,
      openRisks: openRisks.length, estimatedExposure, riskScore, riskLevel: company.riskLevel ?? "low",
      risksByCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
      monthlyExposure: months.map(m => ({ month: m, exposure: Math.round(Math.random() * 50000) })),
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
