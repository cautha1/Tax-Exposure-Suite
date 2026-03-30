import { Router, type IRouter } from "express";
import { db, transactionsTable, uploadsTable, companiesTable, taxRiskFlagsTable } from "../lib/db.js";
import { eq, ilike, and, count, sql } from "drizzle-orm";

const router: IRouter = Router();

const fmtTx = (t: typeof transactionsTable.$inferSelect) => ({
  id: t.id, companyId: t.companyId, transactionDate: t.transactionDate ?? null,
  description: t.description ?? null, reference: t.reference ?? null,
  amount: t.amount ? Number(t.amount) : null, currency: t.currency ?? null,
  accountCode: t.accountCode ?? null, accountCategory: t.accountCategory ?? null,
  vendorName: t.vendorName ?? null, customerName: t.customerName ?? null,
  taxType: t.taxType ?? null, vatAmount: t.vatAmount ? Number(t.vatAmount) : null,
  withholdingTaxAmount: t.withholdingTaxAmount ? Number(t.withholdingTaxAmount) : null,
  transactionType: t.transactionType ?? null, createdAt: t.createdAt,
});

router.get("/transactions", async (req, res) => {
  try {
    const { companyId, search, taxType, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;
    const conditions = [];
    if (companyId) conditions.push(eq(transactionsTable.companyId, companyId));
    if (search) conditions.push(ilike(transactionsTable.description, `%${search}%`));
    if (taxType) conditions.push(eq(transactionsTable.taxType, taxType));
    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = await db.select({ total: count() }).from(transactionsTable).where(where);
    const rows = await db.select().from(transactionsTable).where(where).limit(limitNum).offset(offset);
    res.json({ data: rows.map(fmtTx), total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.post("/transactions/upload", async (req, res) => {
  try {
    const { companyId, transactions, fileName } = req.body;
    if (!companyId || !Array.isArray(transactions)) { res.status(400).json({ error: "companyId and transactions array required" }); return; }

    const [upload] = await db.insert(uploadsTable).values({
      companyId, fileName: fileName || "upload.csv", rowCount: transactions.length, status: "completed",
    }).returning();

    if (transactions.length > 0) {
      const rows = transactions.map((t: Record<string, string>) => ({
        companyId, uploadId: upload.id,
        transactionDate: t.transaction_date || null, description: t.description || null,
        reference: t.reference || null, amount: t.amount || null,
        currency: t.currency || "USD", accountCode: t.account_code || null,
        accountCategory: t.account_category || null, vendorName: t.vendor_name || null,
        customerName: t.customer_name || null, taxType: t.tax_type || null,
        vatAmount: t.vat_amount || null, withholdingTaxAmount: t.withholding_tax_amount || null,
        transactionType: t.transaction_type || null,
      }));
      await db.insert(transactionsTable).values(rows);

      const flags = [];
      for (const t of rows) {
        if (!t.vatAmount && t.taxType === "VAT") {
          flags.push({ companyId, ruleCode: "VAT-001", description: `Zero VAT: ${t.description ?? t.reference}`, severity: "medium", estimatedExposure: String(Number(t.amount) * 0.075), status: "open", category: "VAT" });
        }
        if (!t.withholdingTaxAmount && t.taxType === "WHT") {
          flags.push({ companyId, ruleCode: "WHT-001", description: `Missing WHT: ${t.description ?? t.reference}`, severity: "high", estimatedExposure: String(Number(t.amount) * 0.05), status: "open", category: "Withholding Tax" });
        }
      }
      if (flags.length > 0) await db.insert(taxRiskFlagsTable).values(flags);

      const [co] = await db.select({ tc: companiesTable.transactionCount, ofc: companiesTable.openFlagsCount }).from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
      if (co) {
        await db.update(companiesTable).set({
          transactionCount: (co.tc ?? 0) + transactions.length,
          openFlagsCount: (co.ofc ?? 0) + flags.length,
          updatedAt: new Date(),
        }).where(eq(companiesTable.id, companyId));
      }
    }

    res.json({ uploadId: upload.id, rowsImported: transactions.length, message: `Successfully imported ${transactions.length} transactions` });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
