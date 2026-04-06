import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";

const router: IRouter = Router();

export const DEFAULT_RULES = [
  { ruleCode: "VAT-001", ruleName: "Zero VAT on Taxable Transaction", category: "VAT", description: "Flags transactions marked as VAT-taxable but with no VAT amount. Uganda standard rate: 18%.", enabled: true, threshold: null },
  { ruleCode: "VAT-002", ruleName: "Incorrect VAT Rate", category: "VAT", description: "Flags transactions where VAT rate deviates more than ±2% from Uganda's 18% standard rate.", enabled: true, threshold: null },
  { ruleCode: "VAT-003", ruleName: "Unclassified Large Transaction", category: "VAT", description: "Large transactions with no tax classification — may be subject to 18% VAT.", enabled: true, threshold: 1000000 },
  { ruleCode: "WHT-001", ruleName: "Missing WHT Amount", category: "Withholding Tax", description: "WHT-type transactions with no withholding amount deducted. Uganda standard WHT rate: 15%.", enabled: true, threshold: null },
  { ruleCode: "WHT-002", ruleName: "Service Payment Without WHT", category: "Withholding Tax", description: "Service/professional/dividend/rent payments above threshold with no 15% WHT.", enabled: true, threshold: 500000 },
  { ruleCode: "WHT-003", ruleName: "Excessive WHT Rate", category: "Withholding Tax", description: "Withholding tax rate more than 2% above Uganda statutory 15%.", enabled: true, threshold: null },
  { ruleCode: "PAYE-001", ruleName: "Payroll Without PAYE", category: "PAYE", description: "Payroll/salary transactions above threshold with no PAYE recorded. Uganda top marginal rate: 30%.", enabled: true, threshold: 100000 },
  { ruleCode: "EXP-001", ruleName: "Unusually Large Expense", category: "Expense", description: "Single expense transaction above defined threshold — review for deductibility under Uganda ITA.", enabled: true, threshold: 50000000 },
  { ruleCode: "EXP-002", ruleName: "Non-Deductible Expense", category: "Expense", description: "Expenses in categories typically disallowed under Uganda Income Tax Act (entertainment, gifts, fines, etc.).", enabled: true, threshold: null },
  { ruleCode: "EXP-003", ruleName: "Duplicate Expense", category: "Expense", description: "Same vendor, amount, and date appearing more than once — potential double-counting.", enabled: true, threshold: null },
  { ruleCode: "REV-001", ruleName: "Large Revenue Transaction", category: "Revenue", description: "Very large revenue transactions — confirm correct VAT/income tax treatment.", enabled: true, threshold: 500000000 },
  { ruleCode: "REV-002", ruleName: "Revenue Without Tax Classification", category: "Revenue", description: "Revenue transactions missing tax type — verify 18% VAT liability.", enabled: true, threshold: null },
];

interface RuleConfig {
  id: string; companyId: string | null; ruleCode: string; ruleName: string;
  category: string | null; enabled: boolean; threshold: number | string | null;
  description: string | null; createdAt: string; updatedAt: string;
}

router.get("/rules", async (req, res) => {
  try {
    const { companyId } = req.query as Record<string, string>;

    let q = supabase.from("optional_rules_config").select("*").order("rule_code");
    if (companyId) q = q.or(`company_id.eq.${companyId},company_id.is.null`);

    const { data, error } = await q;
    sbErr(error, "list rules");

    if (!data || data.length === 0) {
      res.json(DEFAULT_RULES.map(r => ({ ...r, id: null, companyId: companyId ?? null, createdAt: null })));
      return;
    }
    res.json((data).map((r: unknown) => {
      const rule = toCamel<RuleConfig>(r);
      return { ...rule, threshold: rule.threshold != null ? Number(rule.threshold) : null };
    }));
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.put("/rules/:ruleCode", async (req, res) => {
  try {
    const { ruleCode } = req.params;
    const { companyId, enabled, threshold } = req.body;

    let q = supabase.from("optional_rules_config").select("*").eq("rule_code", ruleCode);
    if (companyId) q = q.eq("company_id", companyId);
    else q = q.is("company_id", null);
    const { data: existing } = await q.limit(1);

    const defaultRule = DEFAULT_RULES.find(r => r.ruleCode === ruleCode);

    if (existing && existing.length > 0) {
      const curr = toCamel<RuleConfig>(existing[0]);
      const { data, error } = await supabase.from("optional_rules_config").update({
        enabled: enabled ?? curr.enabled,
        threshold: threshold != null ? threshold : curr.threshold,
        updated_at: new Date().toISOString(),
      }).eq("id", curr.id).select().single();
      sbErr(error, "update rule");
      const updated = toCamel<RuleConfig>(data);
      res.json({ ...updated, threshold: updated.threshold != null ? Number(updated.threshold) : null });
    } else {
      const { data, error } = await supabase.from("optional_rules_config").insert({
        rule_code: ruleCode,
        rule_name: defaultRule?.ruleName ?? ruleCode,
        category: defaultRule?.category ?? "General",
        description: defaultRule?.description ?? null,
        company_id: companyId ?? null,
        enabled: enabled ?? true,
        threshold: threshold != null ? threshold : (defaultRule?.threshold ?? null),
      }).select().single();
      sbErr(error, "create rule");
      const created = toCamel<RuleConfig>(data);
      res.json({ ...created, threshold: created.threshold != null ? Number(created.threshold) : null });
    }
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
