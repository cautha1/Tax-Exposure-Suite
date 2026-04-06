import { Router, type IRouter } from "express";
import { db, transactionsTable, taxRiskFlagsTable, companiesTable, optionalRulesConfigTable } from "../lib/db.js";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

const UG_VAT_RATE = 0.18;
const UG_WHT_RATE = 0.15;
const UG_PAYE_TOP_RATE = 0.30;

interface Transaction {
  id: string;
  companyId: string;
  amount: string | null;
  vatAmount: string | null;
  withholdingTaxAmount: string | null;
  taxType: string | null;
  transactionType: string | null;
  accountCategory: string | null;
  description: string | null;
  reference: string | null;
  vendorName: string | null;
  customerName: string | null;
  transactionDate: string | null;
}

interface Flag {
  companyId: string;
  transactionId?: string;
  ruleCode: string;
  riskType: string;
  description: string;
  severity: "high" | "medium" | "low";
  estimatedExposure: string;
  status: "open";
  category: string;
}

function runVatRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const vat = Number(tx.vatAmount ?? 0);

  if (rules.has("VAT-001") && tx.taxType === "VAT" && vat === 0 && amt > 0) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "VAT-001", riskType: "VAT",
      description: `Taxable transaction with zero VAT recorded (Uganda rate 18%): ${tx.description ?? tx.reference ?? "Unknown"}`,
      severity: "high", estimatedExposure: String(amt * UG_VAT_RATE), status: "open", category: "VAT",
    });
  }

  if (rules.has("VAT-002") && tx.taxType === "VAT" && vat > 0 && amt > 0) {
    const vatRate = vat / amt;
    const tolerance = 0.02;
    if (vatRate < UG_VAT_RATE - tolerance || vatRate > UG_VAT_RATE + tolerance) {
      const diff = Math.abs(vat - amt * UG_VAT_RATE);
      flags.push({
        companyId: tx.companyId, transactionId: tx.id,
        ruleCode: "VAT-002", riskType: "VAT",
        description: `VAT rate ${(vatRate * 100).toFixed(1)}% deviates from Uganda standard 18% on: ${tx.description ?? tx.reference ?? "Unknown"}`,
        severity: vatRate < 0.05 ? "high" : "medium",
        estimatedExposure: String(diff), status: "open", category: "VAT",
      });
    }
  }

  if (rules.has("VAT-003") && !tx.taxType && amt > (thresholds["VAT-003"] ?? 1000000)) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "VAT-003", riskType: "VAT",
      description: `Large transaction with no tax classification — may be VAT-liable at 18%: ${tx.description ?? tx.reference ?? "Unknown"} (UGX ${amt.toLocaleString()})`,
      severity: "low", estimatedExposure: String(amt * UG_VAT_RATE), status: "open", category: "VAT",
    });
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
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "WHT-001", riskType: "Withholding Tax",
      description: `Transaction marked WHT with no withholding amount (Uganda rate 15%): ${tx.description ?? tx.reference ?? "Unknown"}`,
      severity: "high", estimatedExposure: String(amt * UG_WHT_RATE), status: "open", category: "Withholding Tax",
    });
  }

  if (rules.has("WHT-002") && likelyWHT && wht === 0 && amt > (thresholds["WHT-002"] ?? 500000)) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "WHT-002", riskType: "Withholding Tax",
      description: `Service/professional payment with no WHT deducted (Uganda WHT 15%): ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`,
      severity: "high", estimatedExposure: String(amt * UG_WHT_RATE), status: "open", category: "Withholding Tax",
    });
  }

  if (rules.has("WHT-003") && wht > 0 && amt > 0) {
    const whtRate = wht / amt;
    const tolerance = 0.02;
    if (whtRate > UG_WHT_RATE + tolerance) {
      flags.push({
        companyId: tx.companyId, transactionId: tx.id,
        ruleCode: "WHT-003", riskType: "Withholding Tax",
        description: `WHT rate ${(whtRate * 100).toFixed(1)}% exceeds Uganda statutory 15% on: ${tx.description ?? tx.reference ?? "Unknown"}`,
        severity: "medium", estimatedExposure: String(Math.abs(wht - amt * UG_WHT_RATE)), status: "open", category: "Withholding Tax",
      });
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

  if (rules.has("PAYE-001") && isPayroll && !tx.taxType && amt > (thresholds["PAYE-001"] ?? 100000)) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "PAYE-001", riskType: "PAYE",
      description: `Payroll/salary payment with no PAYE recorded (Uganda top marginal rate 30%): ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`,
      severity: "high", estimatedExposure: String(amt * UG_PAYE_TOP_RATE),
      status: "open", category: "PAYE",
    });
  }

  if (rules.has("PAYE-002") && isPayroll && tx.taxType === "PAYE") {
    const paye = Number(tx.vatAmount ?? 0);
    if (paye > 0 && amt > 0) {
      const payeRate = paye / amt;
      if (payeRate > UG_PAYE_TOP_RATE + 0.02) {
        flags.push({
          companyId: tx.companyId, transactionId: tx.id,
          ruleCode: "PAYE-002", riskType: "PAYE",
          description: `PAYE rate ${(payeRate * 100).toFixed(1)}% exceeds Uganda maximum rate of 30% on: ${tx.description ?? "Unknown"}`,
          severity: "medium", estimatedExposure: String(paye - amt * UG_PAYE_TOP_RATE),
          status: "open", category: "PAYE",
        });
      }
    }
  }

  return flags;
}

function runExpenseRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>, allTx: Transaction[]): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const expenseCats = ["expense", "cost", "overhead", "entertainment", "travel"];
  const cat = (tx.accountCategory ?? "").toLowerCase();
  const isExpense = expenseCats.some(k => cat.includes(k));
  const nonDeductible = ["entertainment", "personal", "fine", "penalty", "gift", "donation"];
  const isNonDeductible = nonDeductible.some(k => cat.includes(k));

  if (rules.has("EXP-001") && isExpense && amt > (thresholds["EXP-001"] ?? 50000000)) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "EXP-001", riskType: "Expense",
      description: `Unusually large expense — review for tax deductibility: ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`,
      severity: "high", estimatedExposure: String(amt * 0.30), status: "open", category: "Expense",
    });
  }

  if (rules.has("EXP-002") && isNonDeductible && amt > 0) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "EXP-002", riskType: "Expense",
      description: `Potentially non-deductible expense under Uganda tax law (${tx.accountCategory}): ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()})`,
      severity: "medium", estimatedExposure: String(amt * 0.30), status: "open", category: "Expense",
    });
  }

  if (rules.has("EXP-003") && isExpense) {
    const dupes = allTx.filter(t =>
      t.id !== tx.id &&
      t.vendorName === tx.vendorName &&
      t.amount === tx.amount &&
      t.transactionDate === tx.transactionDate &&
      t.vendorName
    );
    if (dupes.length > 0 && tx.id < (dupes[0]?.id ?? "")) {
      flags.push({
        companyId: tx.companyId, transactionId: tx.id,
        ruleCode: "EXP-003", riskType: "Expense",
        description: `Possible duplicate expense — same vendor, amount, and date: ${tx.description ?? tx.vendorName ?? "Unknown"} (UGX ${amt.toLocaleString()}) on ${tx.transactionDate}`,
        severity: "medium", estimatedExposure: String(amt), status: "open", category: "Expense",
      });
    }
  }

  return flags;
}

function runRevenueRules(tx: Transaction, rules: Set<string>, thresholds: Record<string, number>): Flag[] {
  const flags: Flag[] = [];
  const amt = Number(tx.amount ?? 0);
  const revenueCats = ["revenue", "income", "sales", "turnover"];
  const cat = (tx.accountCategory ?? "").toLowerCase();
  const type = (tx.transactionType ?? "").toLowerCase();
  const isRevenue = revenueCats.some(k => cat.includes(k)) || type === "credit";

  if (rules.has("REV-001") && isRevenue && amt > (thresholds["REV-001"] ?? 500000000)) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "REV-001", riskType: "Revenue",
      description: `Very large revenue transaction — confirm correct tax treatment: ${tx.description ?? tx.customerName ?? "Unknown"} (UGX ${amt.toLocaleString()})`,
      severity: "medium", estimatedExposure: String(amt * UG_VAT_RATE), status: "open", category: "Revenue",
    });
  }

  if (rules.has("REV-002") && isRevenue && !tx.taxType) {
    flags.push({
      companyId: tx.companyId, transactionId: tx.id,
      ruleCode: "REV-002", riskType: "Revenue",
      description: `Revenue transaction with no tax classification — verify VAT liability at 18%: ${tx.description ?? tx.customerName ?? "Unknown"} (UGX ${amt.toLocaleString()})`,
      severity: "low", estimatedExposure: String(amt * UG_VAT_RATE), status: "open", category: "Revenue",
    });
  }

  return flags;
}

router.post("/analysis/run", async (req, res) => {
  try {
    const { companyId, clearExisting = true } = req.body;
    if (!companyId) { res.status(400).json({ error: "companyId required" }); return; }

    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }

    const allTx = await db.select().from(transactionsTable).where(eq(transactionsTable.companyId, companyId)) as Transaction[];

    const rulesConfig = await db.select().from(optionalRulesConfigTable).where(
      and(
        eq(optionalRulesConfigTable.enabled, true),
        sql`(${optionalRulesConfigTable.companyId} = ${companyId} OR ${optionalRulesConfigTable.companyId} IS NULL)`
      )
    );

    const enabledRules = new Set<string>(
      rulesConfig.length > 0
        ? rulesConfig.map(r => r.ruleCode)
        : ["VAT-001","VAT-002","VAT-003","WHT-001","WHT-002","WHT-003","PAYE-001","PAYE-002","EXP-001","EXP-002","EXP-003","REV-001","REV-002"]
    );

    const thresholds: Record<string, number> = Object.fromEntries(
      rulesConfig.filter(r => r.threshold).map(r => [r.ruleCode, Number(r.threshold)])
    );

    if (clearExisting) {
      await db.delete(taxRiskFlagsTable).where(
        and(eq(taxRiskFlagsTable.companyId, companyId), eq(taxRiskFlagsTable.status, "open"))
      );
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
      await db.insert(taxRiskFlagsTable).values(allFlags);
    }

    const totalExposure = allFlags.reduce((s, f) => s + Number(f.estimatedExposure), 0);
    const highCount = allFlags.filter(f => f.severity === "high").length;
    const medCount = allFlags.filter(f => f.severity === "medium").length;
    const lowCount = allFlags.filter(f => f.severity === "low").length;

    const catMap: Record<string, { count: number; exposure: number }> = {};
    for (const f of allFlags) {
      if (!catMap[f.category]) catMap[f.category] = { count: 0, exposure: 0 };
      catMap[f.category].count++;
      catMap[f.category].exposure += Number(f.estimatedExposure);
    }

    const riskScore = Math.min(100, Math.round(
      (highCount * 10 + medCount * 5 + lowCount * 1) / Math.max(allTx.length, 1) * 10
    ));
    const riskLevel = riskScore > 60 ? "high" : riskScore > 30 ? "medium" : "low";

    await db.update(companiesTable).set({
      openFlagsCount: allFlags.length,
      riskScore: String(riskScore),
      riskLevel,
      estimatedExposure: String(totalExposure),
      updatedAt: new Date(),
    }).where(eq(companiesTable.id, companyId));

    res.json({
      companyId,
      transactionsAnalysed: allTx.length,
      totalFlags: allFlags.length,
      totalEstimatedExposure: totalExposure,
      riskScore,
      riskLevel,
      taxJurisdiction: "Uganda (URA)",
      vatRate: "18%",
      whtRate: "15%",
      payeTopRate: "30%",
      severityBreakdown: { high: highCount, medium: medCount, low: lowCount },
      byCategory: Object.entries(catMap).map(([category, v]) => ({
        category, count: v.count, exposure: Math.round(v.exposure),
      })),
      rulesApplied: [...enabledRules],
      message: `Analysis complete under Uganda tax rules. ${allFlags.length} risk indicators found across ${allTx.length} transactions.`,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
