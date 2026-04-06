import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";

const router: IRouter = Router();

const UG_VAT_RATE = 0.18;
const UG_WHT_RATE = 0.15;
const UG_PAYE_TOP_RATE = 0.30;

interface Transaction {
  id: string; companyId: string; amount: string | null; vatAmount: string | null;
  withholdingTaxAmount: string | null; taxType: string | null; transactionType: string | null;
  accountCategory: string | null; description: string | null; reference: string | null;
  vendorName: string | null; customerName: string | null; transactionDate: string | null;
}

type Confidence = "high" | "medium" | "low";

interface Flag {
  company_id: string; transaction_id?: string; rule_code: string; risk_type: string;
  description: string; severity: "high" | "medium" | "low"; estimated_exposure: number;
  status: "open"; category: string; confidence: Confidence; risk_score: number;
}

function severityWeight(s: "high" | "medium" | "low"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}
function exposureWeight(exposure: number): number {
  if (exposure > 20_000_000) return 4;
  if (exposure >= 5_000_000) return 3;
  if (exposure >= 500_000) return 2;
  return 1;
}
function confidenceWeight(c: Confidence): number {
  return c === "high" ? 1.5 : c === "medium" ? 1 : 0.5;
}
function computeRiskScore(severity: "high" | "medium" | "low", exposure: number, confidence: Confidence): number {
  return Math.round(severityWeight(severity) * exposureWeight(exposure) * confidenceWeight(confidence) * 10) / 10;
}

function makeFlag(
  base: Omit<Flag, "confidence" | "risk_score">,
  confidence: Confidence
): Flag {
  return { ...base, confidence, risk_score: computeRiskScore(base.severity, base.estimated_exposure, confidence) };
}

function runVatRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const vat = Number(tx.vatAmount ?? 0);

  if (rules.has("VAT-001") && tx.taxType === "VAT" && vat === 0 && amt > 0) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "VAT-001", risk_type: "VAT", description: `Taxable transaction with zero VAT recorded (Uganda rate 18%): ${tx.description ?? tx.reference ?? "Unknown"}`, severity: "high", estimated_exposure: amt * UG_VAT_RATE, status: "open", category: "VAT" }, "high"));
  }
  if (rules.has("VAT-002") && tx.taxType === "VAT" && vat > 0 && amt > 0) {
    const vatRate = vat / amt;
    if (vatRate < UG_VAT_RATE - 0.02 || vatRate > UG_VAT_RATE + 0.02) {
      const diff = Math.abs(vat - amt * UG_VAT_RATE);
      const sev: "high" | "medium" = vatRate < 0.05 ? "high" : "medium";
      flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "VAT-002", risk_type: "VAT", description: `VAT rate ${(vatRate * 100).toFixed(1)}% deviates from Uganda standard 18% on: ${tx.description ?? tx.reference ?? "Unknown"}`, severity: sev, estimated_exposure: diff, status: "open", category: "VAT" }, "high"));
    }
  }
  if (rules.has("VAT-003") && !tx.taxType && amt > (thresholds["VAT-003"] ?? 1000000)) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "VAT-003", risk_type: "VAT", description: `Large transaction with no tax classification — may be VAT-liable at 18%: ${tx.description ?? tx.reference ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "low", estimated_exposure: amt * UG_VAT_RATE, status: "open", category: "VAT" }, "high"));
  }
  return flags;
}

function runWhtRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const wht = Number(tx.withholdingTaxAmount ?? 0);
  const whtCats = ["services", "professional fees", "contractor", "consulting", "commission", "dividends", "interest", "rent"];
  const cat = (tx.accountCategory ?? "").toLowerCase();
  const likelyWHT = whtCats.some(k => cat.includes(k));

  if (rules.has("WHT-001") && tx.taxType === "WHT" && wht === 0 && amt > 0) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "WHT-001", risk_type: "Withholding Tax", description: `Transaction marked WHT with no withholding amount (Uganda rate 15%): ${tx.description ?? tx.reference ?? "Unknown"}`, severity: "high", estimated_exposure: amt * UG_WHT_RATE, status: "open", category: "Withholding Tax" }, "high"));
  }
  if (rules.has("WHT-002") && likelyWHT && wht === 0 && amt > (thresholds["WHT-002"] ?? 500000)) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "WHT-002", risk_type: "Withholding Tax", description: `Service/professional payment with no WHT deducted (Uganda WHT 15%): ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "high", estimated_exposure: amt * UG_WHT_RATE, status: "open", category: "Withholding Tax" }, "high"));
  }
  if (rules.has("WHT-003") && wht > 0 && amt > 0) {
    const whtRate = wht / amt;
    if (whtRate > UG_WHT_RATE + 0.02) {
      flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "WHT-003", risk_type: "Withholding Tax", description: `WHT rate ${(whtRate * 100).toFixed(1)}% exceeds Uganda statutory 15% on: ${tx.description ?? tx.reference ?? "Unknown"}`, severity: "medium", estimated_exposure: Math.abs(wht - amt * UG_WHT_RATE), status: "open", category: "Withholding Tax" }, "medium"));
    }
  }
  return flags;
}

function runPayeRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const payeCats = ["payroll", "salary", "salaries", "wages", "emoluments", "staff costs", "staff cost"];
  const cat = (tx.accountCategory ?? "").toLowerCase();
  const desc = (tx.description ?? "").toLowerCase();
  const isPayroll = payeCats.some(k => cat.includes(k) || desc.includes(k));

  if (rules.has("PAYE-001") && isPayroll && tx.taxType !== "PAYE" && amt > (thresholds["PAYE-001"] ?? 100000)) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "PAYE-001", risk_type: "PAYE", description: `Payroll/salary payment with no PAYE recorded (Uganda top marginal rate 30%): ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "high", estimated_exposure: amt * UG_PAYE_TOP_RATE, status: "open", category: "PAYE" }, "high"));
  }
  return flags;
}

function runExpenseRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>, allTx: Transaction[]): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const cat = (tx.accountCategory ?? "").toLowerCase();
  const isExpense = ["expense", "cost", "overhead", "entertainment", "travel"].some(k => cat.includes(k));
  const isNonDeductible = ["entertainment", "personal", "fine", "penalty", "gift", "donation"].some(k => cat.includes(k));

  if (rules.has("EXP-001") && isExpense && amt > (thresholds["EXP-001"] ?? 50000000)) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "EXP-001", risk_type: "Expense", description: `Unusually large expense — review for tax deductibility: ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "high", estimated_exposure: amt * 0.30, status: "open", category: "Expense" }, "medium"));
  }
  if (rules.has("EXP-002") && isNonDeductible && amt > 0) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "EXP-002", risk_type: "Expense", description: `Potentially non-deductible expense under Uganda tax law (${tx.accountCategory}): ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "medium", estimated_exposure: amt * 0.30, status: "open", category: "Expense" }, "medium"));
  }
  if (rules.has("EXP-003") && isExpense) {
    const dupes = allTx.filter(t =>
      t.id !== tx.id && t.vendorName === tx.vendorName && t.amount === tx.amount &&
      t.transactionDate === tx.transactionDate && t.vendorName
    );
    if (dupes.length > 0 && tx.id < (dupes[0]?.id ?? "")) {
      flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "EXP-003", risk_type: "Expense", description: `Possible duplicate expense — same vendor, amount, and date: ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()}) on ${tx.transactionDate}`, severity: "medium", estimated_exposure: amt, status: "open", category: "Expense" }, "medium"));
    }
  }
  return flags;
}

function runRevenueRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const cat = (tx.accountCategory ?? "").toLowerCase();
  const type = (tx.transactionType ?? "").toLowerCase();
  const isRevenue = ["revenue", "income", "sales", "turnover"].some(k => cat.includes(k)) || type === "credit";

  if (rules.has("REV-001") && isRevenue && amt > (thresholds["REV-001"] ?? 500000000)) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "REV-001", risk_type: "Revenue", description: `Very large revenue transaction — confirm correct tax treatment: ${tx.description ?? tx.customerName ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "medium", estimated_exposure: amt * UG_VAT_RATE, status: "open", category: "Revenue" }, "medium"));
  }
  if (rules.has("REV-002") && isRevenue && !tx.taxType) {
    flags.push(makeFlag({ company_id: tx.companyId, transaction_id: tx.id, rule_code: "REV-002", risk_type: "Revenue", description: `Revenue transaction with no tax classification — verify VAT liability at 18%: ${tx.description ?? tx.customerName ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "low", estimated_exposure: amt * UG_VAT_RATE, status: "open", category: "Revenue" }, "medium"));
  }
  return flags;
}

router.post("/analysis/run", async (req, res) => {
  try {
    const { companyId, clearExisting = true } = req.body;
    if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }

    const { data: companyRaw, error: coErr } = await supabase.from("companies").select("*").eq("id", companyId).single();
    if (coErr || !companyRaw) { res.status(404).json({ error: "Company not found" }); return; }

    const { data: txRaw } = await supabase.from("transactions").select("*").eq("company_id", companyId);
    const allTx = (txRaw ?? []).map((t: unknown) => toCamel<Transaction>(t));

    const { data: rulesRaw } = await supabase.from("optional_rules_config").select("*").eq("enabled", true).or(`company_id.eq.${companyId},company_id.is.null`);

    interface RuleRow { ruleCode: string; threshold: string | null; }
    const rulesConfig = (rulesRaw ?? []).map((r: unknown) => toCamel<RuleRow>(r));

    const enabledRules = new Set<string>(
      rulesConfig.length > 0
        ? rulesConfig.map(r => r.ruleCode)
        : ["VAT-001","VAT-002","VAT-003","WHT-001","WHT-002","WHT-003","PAYE-001","EXP-001","EXP-002","EXP-003","REV-001","REV-002"]
    );
    const thresholds: Record<string, number> = Object.fromEntries(
      rulesConfig.filter(r => r.threshold).map(r => [r.ruleCode, Number(r.threshold)])
    );

    if (clearExisting) {
      await supabase.from("tax_risk_flags").delete().eq("company_id", companyId).eq("status", "open");
    }

    const allFlags: Flag[] = [];
    for (const tx of allTx) {
      allFlags.push(...runVatRules(tx, enabledRules, thresholds));
      allFlags.push(...runWhtRules(tx, enabledRules, thresholds));
      allFlags.push(...runPayeRules(tx, enabledRules, thresholds));
      allFlags.push(...runExpenseRules(tx, enabledRules, thresholds, allTx));
      allFlags.push(...runRevenueRules(tx, enabledRules, thresholds));
    }

    if (allFlags.length > 0) {
      const { error: flagErr } = await supabase.from("tax_risk_flags").insert(allFlags);
      sbErr(flagErr, "insert flags");
    }

    const totalExposure = allFlags.reduce((s, f) => s + f.estimated_exposure, 0);
    const highCount = allFlags.filter(f => f.severity === "high").length;
    const medCount = allFlags.filter(f => f.severity === "medium").length;
    const lowCount = allFlags.filter(f => f.severity === "low").length;

    const catMap: Record<string, { count: number; exposure: number }> = {};
    for (const f of allFlags) {
      if (!catMap[f.category]) catMap[f.category] = { count: 0, exposure: 0 };
      catMap[f.category].count++; catMap[f.category].exposure += f.estimated_exposure;
    }

    const MAX_FLAG_SCORE = 18;
    const sumFlagScores = allFlags.reduce((s, f) => s + f.risk_score, 0);
    const riskScore = Math.min(100, Math.round((sumFlagScores / Math.max(allTx.length, 1)) * (100 / MAX_FLAG_SCORE)));
    const riskLevel = riskScore > 75 ? "critical" : riskScore > 50 ? "high" : riskScore > 20 ? "medium" : "low";

    await supabase.from("companies").update({
      open_flags_count: allFlags.length, risk_score: riskScore,
      risk_level: riskLevel, estimated_exposure: totalExposure,
      updated_at: new Date().toISOString(),
    }).eq("id", companyId);

    res.json({
      companyId, transactionsAnalysed: allTx.length, totalFlags: allFlags.length,
      totalEstimatedExposure: totalExposure, riskScore, riskLevel,
      taxJurisdiction: "Uganda (URA)", vatRate: "18%", whtRate: "15%", payeTopRate: "30%",
      severityBreakdown: { high: highCount, medium: medCount, low: lowCount },
      byCategory: Object.entries(catMap).map(([category, v]) => ({ category, count: v.count, exposure: Math.round(v.exposure) })),
      rulesApplied: [...enabledRules],
      message: `Analysis complete under Uganda tax rules. ${allFlags.length} risk indicators found across ${allTx.length} transactions.`,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
