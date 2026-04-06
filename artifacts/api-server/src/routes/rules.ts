import { Router, type IRouter } from "express";
import { db, optionalRulesConfigTable } from "../lib/db.js";
import { eq, or, isNull, sql, and } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_RULES = [
  { ruleCode: "VAT-001", ruleName: "Zero VAT on Taxable Transaction", category: "VAT", description: "Flags transactions marked as VAT-taxable but with no VAT amount recorded.", enabled: true, threshold: null },
  { ruleCode: "VAT-002", ruleName: "Suspicious VAT Rate", category: "VAT", description: "Flags transactions where VAT rate is outside expected range (1%–30%).", enabled: true, threshold: null },
  { ruleCode: "VAT-003", ruleName: "Unclassified Large Transaction", category: "VAT", description: "Large transactions with no tax type classification.", enabled: true, threshold: 1000 },
  { ruleCode: "WHT-001", ruleName: "Missing WHT Amount", category: "Withholding Tax", description: "Transactions marked as WHT with no withholding amount deducted.", enabled: true, threshold: null },
  { ruleCode: "WHT-002", ruleName: "Service Payment Without WHT", category: "Withholding Tax", description: "Service/professional payments above threshold with no WHT.", enabled: true, threshold: 500 },
  { ruleCode: "WHT-003", ruleName: "Excessive WHT Rate", category: "Withholding Tax", description: "Withholding tax rate exceeds 30% of transaction amount.", enabled: true, threshold: null },
  { ruleCode: "EXP-001", ruleName: "Unusually Large Expense", category: "Expense", description: "Single expense transaction above defined threshold.", enabled: true, threshold: 50000 },
  { ruleCode: "EXP-002", ruleName: "Potentially Non-Deductible Expense", category: "Expense", description: "Expenses in categories typically disallowed for tax deduction.", enabled: true, threshold: null },
  { ruleCode: "EXP-003", ruleName: "Duplicate Expense", category: "Expense", description: "Same vendor, amount, and date appearing more than once.", enabled: true, threshold: null },
  { ruleCode: "REV-001", ruleName: "Large Revenue Transaction", category: "Revenue", description: "Very large revenue transactions that may require additional scrutiny.", enabled: true, threshold: 100000 },
  { ruleCode: "REV-002", ruleName: "Revenue Without Tax Classification", category: "Revenue", description: "Revenue transactions missing tax type classification.", enabled: true, threshold: null },
];

router.get("/rules", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;
    const rows = companyId
      ? await db.select().from(optionalRulesConfigTable).where(
          and(
            sql`(${optionalRulesConfigTable.companyId} = ${companyId} OR ${optionalRulesConfigTable.companyId} IS NULL)`,
          )
        ).orderBy(optionalRulesConfigTable.ruleCode)
      : await db.select().from(optionalRulesConfigTable).orderBy(optionalRulesConfigTable.ruleCode);

    if (rows.length === 0) {
      res.json(DEFAULT_RULES.map(r => ({ ...r, id: null, companyId: companyId ?? null, createdAt: null })));
      return;
    }
    res.json(rows.map(r => ({ ...r, threshold: r.threshold ? Number(r.threshold) : null })));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/rules/:ruleCode", async (req, res) => {
  try {
    const { ruleCode } = req.params;
    const { companyId, enabled, threshold } = req.body;
    const existing = await db.select().from(optionalRulesConfigTable).where(
      and(
        eq(optionalRulesConfigTable.ruleCode, ruleCode),
        companyId ? eq(optionalRulesConfigTable.companyId, companyId) : isNull(optionalRulesConfigTable.companyId),
      )
    ).limit(1);

    const defaultRule = DEFAULT_RULES.find(r => r.ruleCode === ruleCode);

    if (existing.length > 0) {
      const [updated] = await db.update(optionalRulesConfigTable).set({
        enabled: enabled ?? existing[0].enabled,
        threshold: threshold != null ? String(threshold) : existing[0].threshold,
        updatedAt: new Date(),
      }).where(eq(optionalRulesConfigTable.id, existing[0].id)).returning();
      res.json({ ...updated, threshold: updated.threshold ? Number(updated.threshold) : null });
    } else {
      const [created] = await db.insert(optionalRulesConfigTable).values({
        ruleCode,
        ruleName: defaultRule?.ruleName ?? ruleCode,
        category: defaultRule?.category ?? "General",
        description: defaultRule?.description ?? null,
        companyId: companyId ?? null,
        enabled: enabled ?? true,
        threshold: threshold != null ? String(threshold) : (defaultRule?.threshold != null ? String(defaultRule.threshold) : null),
      }).returning();
      res.json({ ...created, threshold: created.threshold ? Number(created.threshold) : null });
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
