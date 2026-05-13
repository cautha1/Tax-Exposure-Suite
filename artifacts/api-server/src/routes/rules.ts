import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";
import {
  currentUser,
  requireCompanyAccess,
  requireCompanyManager,
} from "../lib/access.js";

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
  description: string | null; ruleType: string | null; legalReference: string | null;
  createdAt: string; updatedAt: string;
}

const RULE_CLASSIFICATION: Record<string, { ruleType: string; legalReference: string }> = {
  "VAT-001": { ruleType: "deterministic", legalReference: "Uganda VAT Act, standard VAT rate 18%" },
  "VAT-002": { ruleType: "deterministic", legalReference: "Uganda VAT Act, standard VAT rate 18%" },
  "VAT-003": { ruleType: "heuristic", legalReference: "Uganda VAT Act, taxable supplies classification" },
  "WHT-001": { ruleType: "deterministic", legalReference: "Uganda Income Tax Act, withholding tax obligations" },
  "WHT-002": { ruleType: "heuristic", legalReference: "Uganda Income Tax Act, WHT on service and professional payments" },
  "WHT-003": { ruleType: "deterministic", legalReference: "Uganda Income Tax Act, WHT rate validation" },
  "PAYE-001": { ruleType: "heuristic", legalReference: "Uganda Income Tax Act, PAYE employer obligations" },
  "EXP-001": { ruleType: "heuristic", legalReference: "Uganda Income Tax Act, deductible expense review" },
  "EXP-002": { ruleType: "heuristic", legalReference: "Uganda Income Tax Act, non-deductible expenditure" },
  "EXP-003": { ruleType: "deterministic", legalReference: "Audit evidence rule: duplicate expense detection" },
  "REV-001": { ruleType: "heuristic", legalReference: "Uganda VAT and income tax revenue review" },
  "REV-002": { ruleType: "heuristic", legalReference: "Uganda VAT Act, revenue classification review" },
};

router.get("/rules", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;

  try {
    const { companyId } = req.query as Record<string, string>;
    if (companyId && !(await requireCompanyAccess(req, res, companyId))) return;

    let q = supabase.from("optional_rules_config").select("*").order("rule_code");
    if (companyId) q = q.or(`company_id.eq.${companyId},company_id.is.null`);

    const { data, error } = await q;
    sbErr(error, "list rules");

    if (!data || data.length === 0) {
      res.json(DEFAULT_RULES.map(r => ({
        ...r,
        ...(RULE_CLASSIFICATION[r.ruleCode] ?? { ruleType: "heuristic", legalReference: null }),
        id: null,
        companyId: companyId ?? null,
        createdAt: null,
      })));
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
    const user = currentUser(req, res);
    if (!user) return;
    if (companyId) {
      if (!(await requireCompanyManager(req, res, companyId))) return;
    } else if (user.role !== "admin") {
      res.status(403).json({ error: "Only admins can update global rules" });
      return;
    }

    let q = supabase.from("optional_rules_config").select("*").eq("rule_code", ruleCode);
    if (companyId) q = q.eq("company_id", companyId);
    else q = q.is("company_id", null);
    const { data: existing } = await q.limit(1);

    const defaultRule = DEFAULT_RULES.find(r => r.ruleCode === ruleCode);
    const classification = RULE_CLASSIFICATION[ruleCode] ?? { ruleType: "heuristic", legalReference: null };

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
        rule_type: classification.ruleType,
        legal_reference: classification.legalReference,
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
