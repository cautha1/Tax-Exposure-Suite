export const UG_VAT_RATE = 0.18;
export const UG_WHT_RATE = 0.15;
export const UG_PAYE_TOP_RATE = 0.3;

export type Confidence = "high" | "medium" | "low";
export type Severity = "high" | "medium" | "low";
export type DetectionMethod = "deterministic" | "heuristic";

export interface RuleTransaction {
  id: string;
  companyId: string;
  amount: string | number | null;
  vatAmount: string | number | null;
  withholdingTaxAmount: string | number | null;
  taxType: string | null;
  transactionType: string | null;
  accountCategory: string | null;
  description: string | null;
  reference: string | null;
  vendorName: string | null;
  customerName: string | null;
  transactionDate: string | null;
}

export interface RuleConfig {
  ruleCode: string;
  threshold: string | number | null;
}

export interface RiskFlagInsert {
  company_id: string;
  transaction_id?: string;
  rule_code: string;
  risk_type: string;
  issue_title: string;
  description: string;
  severity: Severity;
  estimated_exposure: number;
  status: "open";
  category: string;
  confidence: Confidence;
  risk_score: number;
  detection_method: DetectionMethod;
  legal_reference: string;
  evidence: Record<string, unknown>;
}

export const DEFAULT_RULE_CODES = [
  "VAT-001",
  "VAT-002",
  "VAT-003",
  "WHT-001",
  "WHT-002",
  "WHT-003",
  "PAYE-001",
  "EXP-001",
  "EXP-002",
  "EXP-003",
  "REV-001",
  "REV-002",
];

const RULE_META: Record<string, {
  title: string;
  category: string;
  legalReference: string;
  method: DetectionMethod;
}> = {
  "VAT-001": { title: "Missing VAT on Taxable Transaction", category: "VAT", legalReference: "Uganda VAT Act, standard VAT rate 18%", method: "deterministic" },
  "VAT-002": { title: "Incorrect VAT Rate", category: "VAT", legalReference: "Uganda VAT Act, standard VAT rate 18%", method: "deterministic" },
  "VAT-003": { title: "Large Unclassified VAT Transaction", category: "VAT", legalReference: "Uganda VAT Act, taxable supplies classification", method: "heuristic" },
  "WHT-001": { title: "WHT Not Deducted (15%)", category: "Withholding Tax", legalReference: "Uganda Income Tax Act, withholding tax obligations", method: "deterministic" },
  "WHT-002": { title: "WHT Not Deducted on Service Payment", category: "Withholding Tax", legalReference: "Uganda Income Tax Act, WHT on service and professional payments", method: "heuristic" },
  "WHT-003": { title: "Excessive WHT Rate", category: "Withholding Tax", legalReference: "Uganda Income Tax Act, WHT rate validation", method: "deterministic" },
  "PAYE-001": { title: "Missing PAYE on Payroll", category: "PAYE", legalReference: "Uganda Income Tax Act, PAYE employer obligations", method: "heuristic" },
  "EXP-001": { title: "Unusually Large Expense", category: "Expense", legalReference: "Uganda Income Tax Act, deductible expense review", method: "heuristic" },
  "EXP-002": { title: "Potentially Non-Deductible Expense", category: "Expense", legalReference: "Uganda Income Tax Act, non-deductible expenditure", method: "heuristic" },
  "EXP-003": { title: "Possible Duplicate Expense", category: "Expense", legalReference: "Audit evidence rule: duplicate expense detection", method: "deterministic" },
  "REV-001": { title: "Large Unverified Revenue Transaction", category: "Revenue", legalReference: "Uganda VAT and income tax revenue review", method: "heuristic" },
  "REV-002": { title: "Revenue Without Tax Classification", category: "Revenue", legalReference: "Uganda VAT Act, revenue classification review", method: "heuristic" },
};

function severityWeight(severity: Severity): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function exposureWeight(exposure: number): number {
  if (exposure > 20_000_000) return 4;
  if (exposure >= 5_000_000) return 3;
  if (exposure >= 500_000) return 2;
  return 1;
}

function confidenceWeight(confidence: Confidence): number {
  return confidence === "high" ? 1.5 : confidence === "medium" ? 1 : 0.5;
}

function computeRiskScore(severity: Severity, exposure: number, confidence: Confidence): number {
  return Math.round(severityWeight(severity) * exposureWeight(exposure) * confidenceWeight(confidence) * 10) / 10;
}

function thresholdValue(thresholds: Record<string, number>, ruleCode: string, fallback: number): number {
  return thresholds[ruleCode] ?? fallback;
}

function makeFlag(
  tx: RuleTransaction,
  ruleCode: string,
  description: string,
  severity: Severity,
  estimatedExposure: number,
  confidence: Confidence,
  evidence: Record<string, unknown>,
): RiskFlagInsert {
  const meta = RULE_META[ruleCode];
  return {
    company_id: tx.companyId,
    transaction_id: tx.id,
    rule_code: ruleCode,
    issue_title: meta.title,
    risk_type: meta.category,
    description,
    severity,
    estimated_exposure: Math.round(estimatedExposure),
    status: "open",
    category: meta.category,
    confidence,
    risk_score: computeRiskScore(severity, estimatedExposure, confidence),
    detection_method: meta.method,
    legal_reference: meta.legalReference,
    evidence: {
      transactionId: tx.id,
      transactionDate: tx.transactionDate,
      reference: tx.reference,
      amount: tx.amount != null ? Number(tx.amount) : null,
      ...evidence,
    },
  };
}

export function buildRuleContext(config: RuleConfig[]) {
  const enabledRules = new Set(
    config.length > 0 ? config.map((rule) => rule.ruleCode) : DEFAULT_RULE_CODES,
  );
  const thresholds = Object.fromEntries(
    config
      .filter((rule) => rule.threshold != null && !Number.isNaN(Number(rule.threshold)))
      .map((rule) => [rule.ruleCode, Number(rule.threshold)]),
  );

  return { enabledRules, thresholds };
}

export function runTaxRules(
  txs: RuleTransaction[],
  enabledRules: Set<string>,
  thresholds: Record<string, number>,
): RiskFlagInsert[] {
  const flags: RiskFlagInsert[] = [];

  for (const tx of txs) {
    const amt = Number(tx.amount ?? 0);
    const vat = Number(tx.vatAmount ?? 0);
    const wht = Number(tx.withholdingTaxAmount ?? 0);
    const cat = (tx.accountCategory ?? "").toLowerCase();
    const desc = (tx.description ?? "").toLowerCase();
    const type = (tx.transactionType ?? "").toLowerCase();

    if (enabledRules.has("VAT-001") && tx.taxType === "VAT" && vat === 0 && amt > 0) {
      flags.push(makeFlag(tx, "VAT-001", `Taxable transaction with zero VAT recorded: ${tx.description ?? tx.reference ?? "Unknown"}`, "high", amt * UG_VAT_RATE, "high", { expectedVatRate: UG_VAT_RATE, actualVatAmount: vat }));
    }

    if (enabledRules.has("VAT-002") && tx.taxType === "VAT" && vat > 0 && amt > 0) {
      const vatRate = vat / amt;
      if (vatRate < UG_VAT_RATE - 0.02 || vatRate > UG_VAT_RATE + 0.02) {
        const expectedVat = amt * UG_VAT_RATE;
        flags.push(makeFlag(tx, "VAT-002", `VAT rate ${(vatRate * 100).toFixed(1)}% deviates from Uganda standard 18%: ${tx.description ?? tx.reference ?? "Unknown"}`, vatRate < 0.05 ? "high" : "medium", Math.abs(vat - expectedVat), "high", { expectedVatRate: UG_VAT_RATE, actualVatRate: vatRate, expectedVat, actualVatAmount: vat }));
      }
    }

    if (enabledRules.has("VAT-003") && !tx.taxType && amt > thresholdValue(thresholds, "VAT-003", 1_000_000)) {
      flags.push(makeFlag(tx, "VAT-003", `Large transaction has no tax classification and may be VAT-liable: ${tx.description ?? tx.reference ?? "Unknown"}`, "low", amt * UG_VAT_RATE, "medium", { threshold: thresholdValue(thresholds, "VAT-003", 1_000_000), expectedVatRate: UG_VAT_RATE }));
    }

    const likelyWHT = ["services", "professional fees", "contractor", "consulting", "commission", "dividends", "interest", "rent"].some((key) => cat.includes(key));
    if (enabledRules.has("WHT-001") && tx.taxType === "WHT" && wht === 0 && amt > 0) {
      flags.push(makeFlag(tx, "WHT-001", `Transaction marked WHT has no withholding amount: ${tx.description ?? tx.reference ?? "Unknown"}`, "high", amt * UG_WHT_RATE, "high", { expectedWhtRate: UG_WHT_RATE, actualWhtAmount: wht }));
    }

    if (enabledRules.has("WHT-002") && likelyWHT && wht === 0 && amt > thresholdValue(thresholds, "WHT-002", 500_000)) {
      flags.push(makeFlag(tx, "WHT-002", `Service/professional payment has no WHT deducted: ${tx.description ?? tx.vendorName ?? "Unknown"}`, "high", amt * UG_WHT_RATE, "medium", { expectedWhtRate: UG_WHT_RATE, matchedCategory: tx.accountCategory }));
    }

    if (enabledRules.has("WHT-003") && wht > 0 && amt > 0) {
      const whtRate = wht / amt;
      if (whtRate > UG_WHT_RATE + 0.02) {
        flags.push(makeFlag(tx, "WHT-003", `WHT rate ${(whtRate * 100).toFixed(1)}% exceeds Uganda statutory 15%: ${tx.description ?? tx.reference ?? "Unknown"}`, "medium", Math.abs(wht - amt * UG_WHT_RATE), "high", { expectedWhtRate: UG_WHT_RATE, actualWhtRate: whtRate, actualWhtAmount: wht }));
      }
    }

    const isPayroll = ["payroll", "salary", "salaries", "wages", "emoluments", "staff costs", "staff cost"].some((key) => cat.includes(key) || desc.includes(key));
    if (enabledRules.has("PAYE-001") && isPayroll && tx.taxType !== "PAYE" && amt > thresholdValue(thresholds, "PAYE-001", 100_000)) {
      flags.push(makeFlag(tx, "PAYE-001", `Payroll/salary payment has no PAYE recorded: ${tx.description ?? tx.vendorName ?? "Unknown"}`, "high", amt * UG_PAYE_TOP_RATE, "medium", { expectedPayeTopRate: UG_PAYE_TOP_RATE, matchedCategory: tx.accountCategory }));
    }

    const isExpense = ["expense", "cost", "overhead", "entertainment", "travel"].some((key) => cat.includes(key));
    const isNonDeductible = ["entertainment", "personal", "fine", "penalty", "gift", "donation"].some((key) => cat.includes(key));
    if (enabledRules.has("EXP-001") && isExpense && amt > thresholdValue(thresholds, "EXP-001", 50_000_000)) {
      flags.push(makeFlag(tx, "EXP-001", `Unusually large expense requires deductibility review: ${tx.description ?? tx.vendorName ?? "Unknown"}`, "high", amt * 0.3, "medium", { threshold: thresholdValue(thresholds, "EXP-001", 50_000_000), assumedCorporateTaxRate: 0.3 }));
    }

    if (enabledRules.has("EXP-002") && isNonDeductible && amt > 0) {
      flags.push(makeFlag(tx, "EXP-002", `Potentially non-deductible expense category detected: ${tx.accountCategory}`, "medium", amt * 0.3, "medium", { matchedCategory: tx.accountCategory, assumedCorporateTaxRate: 0.3 }));
    }

    if (enabledRules.has("EXP-003") && isExpense) {
      const duplicate = txs.find((other) =>
        other.id !== tx.id &&
        other.vendorName === tx.vendorName &&
        other.amount === tx.amount &&
        other.transactionDate === tx.transactionDate &&
        Boolean(other.vendorName)
      );
      if (duplicate && tx.id < duplicate.id) {
        flags.push(makeFlag(tx, "EXP-003", `Possible duplicate expense: same vendor, amount, and date: ${tx.description ?? tx.vendorName ?? "Unknown"}`, "medium", amt, "high", { duplicateTransactionId: duplicate.id, vendorName: tx.vendorName }));
      }
    }

    const isRevenue = ["revenue", "income", "sales", "turnover"].some((key) => cat.includes(key)) || type === "credit";
    if (enabledRules.has("REV-001") && isRevenue && amt > thresholdValue(thresholds, "REV-001", 500_000_000)) {
      flags.push(makeFlag(tx, "REV-001", `Very large revenue transaction requires tax treatment review: ${tx.description ?? tx.customerName ?? "Unknown"}`, "medium", amt * UG_VAT_RATE, "medium", { threshold: thresholdValue(thresholds, "REV-001", 500_000_000), expectedVatRate: UG_VAT_RATE }));
    }

    if (enabledRules.has("REV-002") && isRevenue && !tx.taxType) {
      flags.push(makeFlag(tx, "REV-002", `Revenue transaction has no tax classification: ${tx.description ?? tx.customerName ?? "Unknown"}`, "low", amt * UG_VAT_RATE, "medium", { expectedVatRate: UG_VAT_RATE }));
    }
  }

  return flags;
}
