import { Router, type IRouter } from "express";
import { supabase, toCamel } from "../lib/supabase.js";

const router: IRouter = Router();

interface ExplainResult {
  summary: string;
  whyRisk: string;
  exposure: string;
  recommendation: string;
}

function fmtUGX(val: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(Math.round(val))}`;
}

function explainByRule(ruleCode: string, riskType: string, description: string, estimatedExposure: number): ExplainResult {
  const exp = fmtUGX(estimatedExposure);

  switch (ruleCode) {
    case "VAT-001":
      return {
        summary: `This is a potential tax risk indicator: a taxable transaction was recorded with zero VAT, despite Uganda's statutory VAT rate of 18%.`,
        whyRisk: `Under the Uganda Value Added Tax Act (Cap. 349), all taxable supplies must charge VAT at 18%. Failing to account for VAT on a taxable transaction exposes the company to back-taxes, penalties of up to 200% of the tax due, and interest charges from the Uganda Revenue Authority (URA).`,
        exposure: `Estimated VAT liability: ${exp}. This is calculated at 18% of the gross transaction amount. Additional penalties and interest may apply.`,
        recommendation: `1. Verify whether this transaction qualifies as a taxable supply. 2. If VAT-liable, raise a corrective VAT return with URA. 3. Consider voluntary disclosure to reduce penalty exposure. 4. Ensure all future invoices correctly state VAT at 18%.`,
      };

    case "VAT-002":
      return {
        summary: `This is a potential tax risk indicator: the VAT rate applied deviates materially from Uganda's standard 18% rate, suggesting a possible error or incorrect VAT treatment.`,
        whyRisk: `Uganda's VAT Act prescribes a standard rate of 18% for taxable supplies. Using a different rate — whether higher or lower — can lead to under-remittance or over-recovery of VAT, both of which are reportable compliance failures. URA audits routinely identify rate discrepancies as a key indicator of tax risk.`,
        exposure: `Estimated VAT adjustment required: ${exp}. This represents the gap between VAT applied and the correct statutory amount.`,
        recommendation: `1. Review the transaction to confirm the correct VAT classification (standard-rated, zero-rated, or exempt). 2. If the rate was incorrectly applied, file an amended VAT return. 3. Update your accounting system VAT codes to prevent recurrence.`,
      };

    case "VAT-003":
      return {
        summary: `This is a potential tax risk indicator: a large transaction has been processed without any tax classification, which may indicate an unaccounted VAT obligation.`,
        whyRisk: `Unclassified large transactions are a key audit trigger for URA. If the transaction relates to a taxable supply, VAT at 18% should have been collected and remitted. The absence of tax classification suggests the company may not have correctly assessed its VAT obligations on this transaction.`,
        exposure: `Potential VAT liability if taxable: ${exp} (18% of transaction value).`,
        recommendation: `1. Review the nature of this transaction and determine its VAT status. 2. If taxable, retroactively account for VAT and update your VAT return. 3. Establish a tax classification review process for all transactions above UGX 1,000,000.`,
      };

    case "WHT-001":
      return {
        summary: `This is a potential tax risk indicator: a transaction designated as subject to withholding tax (WHT) has no withholding amount deducted, contrary to Uganda's 15% statutory WHT rate.`,
        whyRisk: `Under the Uganda Income Tax Act, withholding tax must be deducted at source on designated payments. Failure to withhold renders the payer (your client) jointly liable for the tax. URA can assess WHT plus 20% penalty and interest from the payment date.`,
        exposure: `Estimated WHT shortfall: ${exp} (at 15% of payment amount).`,
        recommendation: `1. Confirm whether this payment category is subject to WHT under Schedule 1 of the Income Tax Act. 2. If WHT was not deducted, consider making good the payment to URA and seeking reimbursement from the payee. 3. File any outstanding WHT returns with URA.`,
      };

    case "WHT-002":
      return {
        summary: `This is a potential tax risk indicator: a service or professional payment was made without deducting withholding tax, which is required at 15% under Uganda tax law.`,
        whyRisk: `Uganda's Income Tax Act requires withholding tax at 15% on payments to service providers, contractors, consultants, and similar payees. Non-deduction exposes the payer to joint liability, penalties, and URA enforcement action including account freezes.`,
        exposure: `Estimated WHT liability: ${exp} (15% of payment value).`,
        recommendation: `1. Identify all service payments lacking WHT deduction and quantify total exposure. 2. Where possible, recover the WHT from the payee or absorb and remit to URA. 3. File WHT returns (Form WHT 1) for all outstanding periods. 4. Implement vendor payment controls to enforce WHT deduction before payment release.`,
      };

    case "WHT-003":
      return {
        summary: `This is a potential tax risk indicator: the withholding tax rate applied exceeds Uganda's statutory 15%, indicating a potential over-deduction that may expose the company to payee disputes or URA scrutiny.`,
        whyRisk: `While under-deduction is more commonly flagged, over-deduction of WHT can constitute an unlawful deduction from payees. It may also indicate systematic rate errors in the accounting system. URA may question inconsistencies in WHT rates applied across similar transactions.`,
        exposure: `Excess WHT deducted: ${exp} above the 15% statutory rate.`,
        recommendation: `1. Review the WHT configuration in your accounting system. 2. Refund excess WHT to affected payees or net against future payments. 3. Verify whether any special WHT rate applies (e.g., treaty rates, specific sectors). 4. Ensure consistent application of the 15% rate going forward.`,
      };

    case "PAYE-001":
      return {
        summary: `This is a potential tax risk indicator: a payroll or salary payment was processed without PAYE being recorded, which is required under Uganda's Income Tax Act at a top marginal rate of 30%.`,
        whyRisk: `PAYE is a mandatory employer obligation under Uganda's Income Tax Act. Employers must deduct PAYE from all employment income and remit monthly to URA. Non-compliance results in assessments for unpaid PAYE plus 20% penalty and compounding interest. URA cross-references NSSF and payroll data to detect PAYE gaps.`,
        exposure: `Estimated PAYE exposure: ${exp} (applying 30% top marginal rate as a conservative estimate).`,
        recommendation: `1. Review all payroll transactions to identify PAYE obligations for the affected period. 2. File outstanding PAYE returns (Form PAYE 1) with URA. 3. Consider voluntary disclosure to reduce penalty exposure. 4. Implement payroll software with automatic PAYE calculation using Uganda's graduated tax bands.`,
      };

    case "EXP-001":
      return {
        summary: `This is a potential tax risk indicator: an unusually large expense transaction has been identified that may not be fully deductible under Uganda's Income Tax Act.`,
        whyRisk: `Uganda's Income Tax Act (Section 26–30) restricts the deductibility of expenses to those that are wholly and exclusively incurred in the production of income. Large, unusual expenses are a primary audit target for URA and must be supported by adequate documentation. Disallowed deductions result in higher taxable income and additional corporate tax.`,
        exposure: `Potential corporate income tax exposure if disallowed: ${exp} (30% corporate tax rate applied).`,
        recommendation: `1. Gather full documentation for this expense (contract, invoice, business purpose). 2. Assess deductibility under Sections 26–30 of the Income Tax Act. 3. If partially non-deductible, adjust the tax computation accordingly. 4. Consult with a tax advisor before the next filing deadline.`,
      };

    case "EXP-002":
      return {
        summary: `This is a potential tax risk indicator: an expense in a category typically disallowed under Uganda's Income Tax Act has been identified, which may increase your client's taxable income.`,
        whyRisk: `Uganda's Income Tax Act specifically disallows deductions for entertainment, personal expenses, fines, penalties, gifts, and donations (except qualifying charitable donations). Claiming these as deductions inflates allowable expenses and reduces taxable income incorrectly, which can lead to penalties on assessment.`,
        exposure: `Estimated corporate tax exposure if disallowed: ${exp} (30% applied to disallowed amount).`,
        recommendation: `1. Review whether this expense can be recharacterised as a deductible business expense with supporting documentation. 2. If non-deductible, add back to the tax computation in the annual return. 3. Advise your client to establish a clear expense policy categorising non-deductible items.`,
      };

    case "EXP-003":
      return {
        summary: `This is a potential tax risk indicator: a possible duplicate expense has been detected — the same vendor, amount, and date appear more than once in the records.`,
        whyRisk: `Duplicate expenses overstate deductible costs and reduce taxable income incorrectly. In an audit, URA will disallow duplicate claims and may assess penalties for negligence or intentional misstatement. Repeated duplicates can escalate to fraud risk.`,
        exposure: `Potential disallowed duplicate amount: ${exp}. Corporate tax exposure at 30% would be approximately ${fmtUGX(Math.round(parseFloat(String(estimatedExposure)) * 0.30))}.`,
        recommendation: `1. Confirm whether both entries represent genuine separate transactions. 2. If duplicate, reverse the second entry immediately. 3. Implement duplicate detection controls in your accounting workflow. 4. Run a full reconciliation of vendor payments vs. supplier statements.`,
      };

    case "REV-001":
      return {
        summary: `This is a potential tax risk indicator: a very large revenue transaction has been identified that requires verification of correct VAT and income tax treatment.`,
        whyRisk: `Large revenue transactions attract URA attention during audits. If VAT was not correctly applied, significant under-remittance may be owed. Additionally, the income tax treatment (timing, recognition) must comply with Uganda's Income Tax Act. URA increasingly uses bank data and third-party reporting to cross-check large transactions.`,
        exposure: `Potential VAT exposure: ${exp} (18% of transaction value). Income tax implications depend on recognition and deductible costs.`,
        recommendation: `1. Verify VAT was correctly charged and remitted on this transaction. 2. Confirm revenue recognition timing aligns with Uganda tax rules. 3. Ensure supporting documentation (contracts, invoices) is on file for at least 5 years. 4. Consider a pre-audit health check for large transactions.`,
      };

    case "REV-002":
      return {
        summary: `This is a potential tax risk indicator: a revenue transaction is missing a tax classification, which may indicate unaccounted VAT liability at the standard 18% rate.`,
        whyRisk: `All revenue transactions must be assessed for VAT applicability. Missing tax classification suggests the transaction may not have been reviewed for VAT, creating risk of under-remittance. URA can assess VAT on transactions going back up to 5 years.`,
        exposure: `Potential VAT liability: ${exp} (18% of transaction value if taxable).`,
        recommendation: `1. Classify this transaction (standard-rated, zero-rated, exempt, or out of scope). 2. If VAT applies and was not collected, assess options for recovery from the customer or absorption. 3. Update your invoicing template to require tax classification for all revenue entries. 4. Review all unclassified revenue transactions for the current and prior two tax years.`,
      };

    default: {
      const label = riskType || ruleCode;
      return {
        summary: `This is a potential tax risk indicator: a ${label} compliance issue has been detected that may require review under Uganda tax law.`,
        whyRisk: `${label} risks identified during transaction analysis indicate a possible gap between the company's current tax treatment and Uganda Revenue Authority (URA) requirements. Such gaps can lead to underpayment of taxes, penalties, and interest.`,
        exposure: `Estimated exposure: ${exp}. This may increase with penalties and interest depending on the duration and nature of non-compliance.`,
        recommendation: `1. Review the transaction(s) flagged under this rule in detail. 2. Assess the applicable Uganda tax legislation. 3. Consult a tax advisor to determine corrective action and any voluntary disclosure requirements. 4. Document the review and decision for audit trail purposes.`,
      };
    }
  }
}

router.post("/ai/explain-risk", async (req, res) => {
  try {
    const { riskId } = req.body;
    if (!riskId) { res.status(400).json({ error: "riskId is required" }); return; }

    const { data: raw, error } = await supabase.from("tax_risk_flags").select("*").eq("id", riskId).single();
    if (error || !raw) { res.status(404).json({ error: "Risk not found" }); return; }
    const risk = toCamel<{ id: string; ruleCode: string | null; riskType: string | null; description: string | null; estimatedExposure: string | null }>(raw);

    const explanation = explainByRule(
      risk.ruleCode ?? "",
      risk.riskType ?? "",
      risk.description ?? "",
      Number(risk.estimatedExposure ?? 0)
    );

    res.json({ riskId, ruleCode: risk.ruleCode, riskType: risk.riskType, ...explanation });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
