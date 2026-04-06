import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr } from "../lib/supabase.js";

const router: IRouter = Router();

interface Tx {
  id: string; companyId: string; uploadId: string | null;
  transactionDate: string | null; description: string | null; reference: string | null;
  amount: string | number | null; currency: string | null; accountCode: string | null;
  accountCategory: string | null; vendorName: string | null; customerName: string | null;
  taxType: string | null; vatAmount: string | number | null; withholdingTaxAmount: string | number | null;
  transactionType: string | null; createdAt: string;
}

const fmtTx = (t: Tx) => ({
  id: t.id, companyId: t.companyId, uploadId: t.uploadId ?? null,
  transactionDate: t.transactionDate ?? null, description: t.description ?? null,
  reference: t.reference ?? null, amount: t.amount != null ? Number(t.amount) : null,
  currency: t.currency ?? null, accountCode: t.accountCode ?? null,
  accountCategory: t.accountCategory ?? null, vendorName: t.vendorName ?? null,
  customerName: t.customerName ?? null, taxType: t.taxType ?? null,
  vatAmount: t.vatAmount != null ? Number(t.vatAmount) : null,
  withholdingTaxAmount: t.withholdingTaxAmount != null ? Number(t.withholdingTaxAmount) : null,
  transactionType: t.transactionType ?? null, createdAt: t.createdAt,
});

const SORTABLE_COLS: Record<string, string> = {
  transaction_date: "transaction_date",
  amount: "amount",
  description: "description",
  created_at: "created_at",
};

router.get("/transactions", async (req, res) => {
  try {
    const {
      companyId, uploadId, search, taxType, transactionType,
      dateFrom, dateTo, amountMin, amountMax,
      sortBy = "created_at", sortDir = "desc",
      page = "1", limit = "50",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;
    const col = SORTABLE_COLS[sortBy] ?? "created_at";
    const ascending = sortDir === "asc";

    let q = supabase.from("transactions").select("*", { count: "exact" });
    if (companyId) q = q.eq("company_id", companyId);
    if (uploadId) q = q.eq("upload_id", uploadId);
    if (taxType === "NONE") q = q.is("tax_type", null);
    else if (taxType) q = q.eq("tax_type", taxType);
    if (transactionType) q = q.eq("transaction_type", transactionType);
    if (dateFrom) q = q.gte("transaction_date", dateFrom);
    if (dateTo) q = q.lte("transaction_date", dateTo);
    if (amountMin) q = q.gte("amount", amountMin);
    if (amountMax) q = q.lte("amount", amountMax);
    if (search) q = q.or(`description.ilike.%${search}%,reference.ilike.%${search}%,vendor_name.ilike.%${search}%,customer_name.ilike.%${search}%`);

    const { data, error, count } = await q.order(col, { ascending }).range(offset, offset + limitNum - 1);
    sbErr(error, "list transactions");

    res.json({ data: (data ?? []).map((r: unknown) => fmtTx(toCamel<Tx>(r))), total: count ?? 0, page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

const REQUIRED_COLS = ["transaction_date", "description", "amount", "currency"];

router.post("/transactions/upload", async (req, res) => {
  try {
    const { companyId, transactions, fileName } = req.body;
    if (!companyId || !Array.isArray(transactions)) {
      res.status(400).json({ error: "companyId and transactions array required" });
      return;
    }
    if (transactions.length === 0) {
      res.status(400).json({ error: "No transactions provided" });
      return;
    }

    const firstRow = transactions[0] as Record<string, string>;
    const missing = REQUIRED_COLS.filter(c => !(c in firstRow));
    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required columns: ${missing.join(", ")}`, required: REQUIRED_COLS });
      return;
    }

    const rowErrors: Array<{ row: number; errors: string[] }> = [];
    const validRows: Record<string, string>[] = [];

    (transactions as Record<string, string>[]).forEach((t, i) => {
      const errs: string[] = [];
      if (!t.transaction_date) errs.push("transaction_date is required");
      if (!t.amount || isNaN(Number(t.amount))) errs.push("amount must be a valid number");
      if (!t.currency) errs.push("currency is required");
      if (errs.length > 0) rowErrors.push({ row: i + 2, errors: errs });
      else validRows.push(t);
    });

    const { data: uploadData, error: uploadErr } = await supabase.from("uploads").insert({
      company_id: companyId, file_name: fileName ?? "upload.csv",
      row_count: validRows.length, status: validRows.length > 0 ? "completed" : "failed",
    }).select().single();
    sbErr(uploadErr, "create upload");
    const upload = toCamel<{ id: string }>(uploadData);

    const newFlags: Record<string, unknown>[] = [];

    if (validRows.length > 0) {
      const rows = validRows.map(t => ({
        company_id: companyId, upload_id: upload.id,
        transaction_date: t.transaction_date ?? null,
        description: t.description ?? null,
        reference: t.reference ?? null,
        amount: t.amount ?? null,
        currency: t.currency ?? "UGX",
        account_code: t.account_code ?? null,
        account_category: t.account_category ?? null,
        vendor_name: t.vendor_name ?? null,
        customer_name: t.customer_name ?? null,
        tax_type: t.tax_type ?? null,
        vat_amount: t.vat_amount ?? null,
        withholding_tax_amount: t.withholding_tax_amount ?? null,
        transaction_type: t.transaction_type ?? null,
      }));

      const { error: txErr } = await supabase.from("transactions").insert(rows);
      sbErr(txErr, "insert transactions");

      for (const t of rows) {
        const amt = Number(t.amount ?? 0);
        const vat = Number(t.vat_amount ?? 0);
        const wht = Number(t.withholding_tax_amount ?? 0);
        const cat = (t.account_category ?? "").toLowerCase();
        const isService = ["services", "professional", "consulting", "contractor", "commission"].some(k => cat.includes(k));

        if (t.tax_type === "VAT" && vat === 0 && amt > 0) {
          newFlags.push({ company_id: companyId, rule_code: "VAT-001", risk_type: "VAT", description: `Zero VAT on taxable transaction (Uganda rate 18%): ${t.description ?? t.reference ?? "Unknown"}`, severity: "high", estimated_exposure: amt * 0.18, status: "open", category: "VAT" });
        }
        if (t.tax_type === "WHT" && wht === 0 && amt > 0) {
          newFlags.push({ company_id: companyId, rule_code: "WHT-001", risk_type: "Withholding Tax", description: `Missing WHT on WHT-type transaction (Uganda rate 15%): ${t.description ?? "Unknown"}`, severity: "high", estimated_exposure: amt * 0.15, status: "open", category: "Withholding Tax" });
        }
        if (isService && wht === 0 && amt > 500000) {
          newFlags.push({ company_id: companyId, rule_code: "WHT-002", risk_type: "Withholding Tax", description: `Service payment with no WHT deducted (Uganda WHT 15%): ${t.vendor_name ?? t.description ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "high", estimated_exposure: amt * 0.15, status: "open", category: "Withholding Tax" });
        }
      }

      if (newFlags.length > 0) {
        const { error: flagErr } = await supabase.from("tax_risk_flags").insert(newFlags);
        sbErr(flagErr, "insert flags");
      }

      const { data: coRaw } = await supabase.from("companies").select("transaction_count, open_flags_count").eq("id", companyId).single();
      if (coRaw) {
        const co = toCamel<{ transactionCount: number; openFlagsCount: number }>(coRaw);
        await supabase.from("companies").update({
          transaction_count: (co.transactionCount ?? 0) + validRows.length,
          open_flags_count: (co.openFlagsCount ?? 0) + newFlags.length,
          updated_at: new Date().toISOString(),
        }).eq("id", companyId);
      }
    }

    res.json({
      uploadId: upload.id,
      rowsImported: validRows.length,
      rowsFailed: rowErrors.length,
      flagsGenerated: newFlags.length,
      errors: rowErrors,
      message: `Successfully imported ${validRows.length} transactions. ${rowErrors.length} rows skipped. ${newFlags.length} risk indicators generated.`,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
