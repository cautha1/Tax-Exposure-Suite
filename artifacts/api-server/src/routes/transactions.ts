import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";

const router: IRouter = Router();

const fmtTx = (t: Record<string, unknown>) => ({
  id: t.id, companyId: t.company_id, transactionDate: t.transaction_date ?? null,
  description: t.description ?? null, reference: t.reference ?? null,
  amount: t.amount ? Number(t.amount) : null, currency: t.currency ?? null,
  accountCode: t.account_code ?? null, accountCategory: t.account_category ?? null,
  vendorName: t.vendor_name ?? null, customerName: t.customer_name ?? null,
  taxType: t.tax_type ?? null, vatAmount: t.vat_amount ? Number(t.vat_amount) : null,
  withholdingTaxAmount: t.withholding_tax_amount ? Number(t.withholding_tax_amount) : null,
  transactionType: t.transaction_type ?? null, createdAt: t.created_at,
});

router.get("/transactions", async (req, res) => {
  try {
    const { companyId, search, taxType, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const from = (pageNum - 1) * limitNum;
    let query = supabase.from("transactions").select("*", { count: "exact" });
    if (companyId) query = query.eq("company_id", companyId);
    if (search) query = query.ilike("description", `%${search}%`);
    if (taxType) query = query.eq("tax_type", taxType);
    const { data, error, count } = await query.range(from, from + limitNum - 1);
    if (error) throw error;
    res.json({ data: (data ?? []).map(fmtTx), total: count ?? 0, page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/transactions/upload", async (req, res) => {
  try {
    const { companyId, transactions, fileName } = req.body;
    if (!companyId || !Array.isArray(transactions)) { res.status(400).json({ error: "companyId and transactions array required" }); return; }

    const { data: upload, error: uploadErr } = await supabase.from("uploads").insert({
      company_id: companyId, file_name: fileName || "upload.csv",
      row_count: transactions.length, status: "completed",
    }).select().single();
    if (uploadErr || !upload) { res.status(500).json({ error: uploadErr?.message ?? "Upload failed" }); return; }

    if (transactions.length > 0) {
      const rows = transactions.map((t: Record<string, string>) => ({
        company_id: companyId, upload_id: upload.id,
        transaction_date: t.transaction_date || null, description: t.description || null,
        reference: t.reference || null, amount: t.amount ? Number(t.amount) : null,
        currency: t.currency || "USD", account_code: t.account_code || null,
        account_category: t.account_category || null, vendor_name: t.vendor_name || null,
        customer_name: t.customer_name || null, tax_type: t.tax_type || null,
        vat_amount: t.vat_amount ? Number(t.vat_amount) : null,
        withholding_tax_amount: t.withholding_tax_amount ? Number(t.withholding_tax_amount) : null,
        transaction_type: t.transaction_type || null,
      }));
      await supabase.from("transactions").insert(rows);

      // Auto-generate risk flags
      const flags: Record<string, unknown>[] = [];
      for (const t of rows) {
        if (!t.vat_amount && t.tax_type === "VAT") {
          flags.push({ company_id: companyId, rule_code: "VAT-001", description: `Zero VAT: ${t.description ?? t.reference}`, severity: "medium", estimated_exposure: Number(t.amount) * 0.075, status: "open", category: "VAT" });
        }
        if (!t.withholding_tax_amount && t.tax_type === "WHT") {
          flags.push({ company_id: companyId, rule_code: "WHT-001", description: `Missing WHT: ${t.description ?? t.reference}`, severity: "high", estimated_exposure: Number(t.amount) * 0.05, status: "open", category: "Withholding Tax" });
        }
      }
      if (flags.length > 0) await supabase.from("tax_risk_flags").insert(flags);

      // Update company counts
      const { data: co } = await supabase.from("companies").select("transaction_count, open_flags_count").eq("id", companyId).single();
      if (co) {
        await supabase.from("companies").update({
          transaction_count: (co.transaction_count ?? 0) + transactions.length,
          open_flags_count: (co.open_flags_count ?? 0) + flags.length,
          updated_at: new Date().toISOString(),
        }).eq("id", companyId);
      }
    }

    res.json({ uploadId: upload.id, rowsImported: transactions.length, message: `Successfully imported ${transactions.length} transactions` });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
