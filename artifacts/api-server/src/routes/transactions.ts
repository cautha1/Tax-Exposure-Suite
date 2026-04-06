import { Router, type IRouter } from "express";
import { db, transactionsTable, uploadsTable, companiesTable, taxRiskFlagsTable } from "../lib/db.js";
import { eq, ilike, and, gte, lte, or, count, asc, desc, sql, isNull } from "drizzle-orm";

const router: IRouter = Router();

const fmtTx = (t: typeof transactionsTable.$inferSelect) => ({
  id: t.id, companyId: t.companyId, uploadId: t.uploadId ?? null,
  transactionDate: t.transactionDate ?? null, description: t.description ?? null,
  reference: t.reference ?? null, amount: t.amount ? Number(t.amount) : null,
  currency: t.currency ?? null, accountCode: t.accountCode ?? null,
  accountCategory: t.accountCategory ?? null, vendorName: t.vendorName ?? null,
  customerName: t.customerName ?? null, taxType: t.taxType ?? null,
  vatAmount: t.vatAmount ? Number(t.vatAmount) : null,
  withholdingTaxAmount: t.withholdingTaxAmount ? Number(t.withholdingTaxAmount) : null,
  transactionType: t.transactionType ?? null, createdAt: t.createdAt,
});

const SORTABLE = new Set(["transaction_date", "amount", "description", "created_at"]);
const colMap: Record<string, typeof transactionsTable[keyof typeof transactionsTable]> = {
  transaction_date: transactionsTable.transactionDate,
  amount: transactionsTable.amount,
  description: transactionsTable.description,
  created_at: transactionsTable.createdAt,
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

    const conditions = [];
    if (companyId) conditions.push(eq(transactionsTable.companyId, companyId));
    if (uploadId) conditions.push(eq(transactionsTable.uploadId!, uploadId));
    if (taxType === "NONE") {
      conditions.push(isNull(transactionsTable.taxType));
    } else if (taxType) {
      conditions.push(eq(transactionsTable.taxType, taxType));
    }
    if (transactionType) conditions.push(eq(transactionsTable.transactionType, transactionType));
    if (dateFrom) conditions.push(gte(transactionsTable.transactionDate, dateFrom));
    if (dateTo) conditions.push(lte(transactionsTable.transactionDate, dateTo));
    if (amountMin) conditions.push(gte(transactionsTable.amount, amountMin));
    if (amountMax) conditions.push(lte(transactionsTable.amount, amountMax));
    if (search) {
      conditions.push(or(
        ilike(transactionsTable.description, `%${search}%`),
        ilike(transactionsTable.reference, `%${search}%`),
        ilike(transactionsTable.vendorName, `%${search}%`),
        ilike(transactionsTable.customerName, `%${search}%`),
      ));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = await db.select({ total: count() }).from(transactionsTable).where(where);

    const sortCol = SORTABLE.has(sortBy) ? colMap[sortBy] : transactionsTable.createdAt;
    const orderFn = sortDir === "asc" ? asc : desc;
    const rows = await db.select().from(transactionsTable).where(where)
      .orderBy(orderFn(sortCol as any)).limit(limitNum).offset(offset);

    res.json({ data: rows.map(fmtTx), total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

const REQUIRED_COLS = ["transaction_date","description","amount","currency"];
const ALL_COLS = [
  "transaction_date","description","reference","amount","currency","account_code",
  "account_category","vendor_name","customer_name","tax_type","vat_amount",
  "withholding_tax_amount","transaction_type"
];

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
    const validRows: typeof transactions = [];

    transactions.forEach((t: Record<string, string>, i: number) => {
      const errs: string[] = [];
      if (!t.transaction_date) errs.push("transaction_date is required");
      if (!t.amount || isNaN(Number(t.amount))) errs.push("amount must be a valid number");
      if (!t.currency) errs.push("currency is required");
      if (errs.length > 0) { rowErrors.push({ row: i + 2, errors: errs }); }
      else { validRows.push(t); }
    });

    const [upload] = await db.insert(uploadsTable).values({
      companyId, fileName: fileName ?? "upload.csv",
      rowCount: validRows.length, status: validRows.length > 0 ? "completed" : "failed",
    }).returning();

    const newFlags: any[] = [];

    if (validRows.length > 0) {
      const rows = validRows.map((t: Record<string, string>) => ({
        companyId, uploadId: upload.id,
        transactionDate: t.transaction_date ?? null,
        description: t.description ?? null,
        reference: t.reference ?? null,
        amount: t.amount ?? null,
        currency: t.currency ?? "USD",
        accountCode: t.account_code ?? null,
        accountCategory: t.account_category ?? null,
        vendorName: t.vendor_name ?? null,
        customerName: t.customer_name ?? null,
        taxType: t.tax_type ?? null,
        vatAmount: t.vat_amount ?? null,
        withholdingTaxAmount: t.withholding_tax_amount ?? null,
        transactionType: t.transaction_type ?? null,
      }));

      await db.insert(transactionsTable).values(rows);

      for (const t of rows) {
        const amt = Number(t.amount ?? 0);
        const vat = Number(t.vatAmount ?? 0);
        const wht = Number(t.withholdingTaxAmount ?? 0);
        const cat = (t.accountCategory ?? "").toLowerCase();
        const isService = ["services","professional","consulting","contractor","commission"].some(k => cat.includes(k));

        if (t.taxType === "VAT" && vat === 0 && amt > 0) {
          newFlags.push({ companyId, ruleCode: "VAT-001", riskType: "VAT", description: `Zero VAT on taxable transaction (Uganda rate 18%): ${t.description ?? t.reference ?? "Unknown"}`, severity: "high", estimatedExposure: String(amt * 0.18), status: "open", category: "VAT" });
        }
        if (t.taxType === "WHT" && wht === 0 && amt > 0) {
          newFlags.push({ companyId, ruleCode: "WHT-001", riskType: "Withholding Tax", description: `Missing WHT on WHT-type transaction (Uganda rate 15%): ${t.description ?? "Unknown"}`, severity: "high", estimatedExposure: String(amt * 0.15), status: "open", category: "Withholding Tax" });
        }
        if (isService && wht === 0 && amt > 500000) {
          newFlags.push({ companyId, ruleCode: "WHT-002", riskType: "Withholding Tax", description: `Service payment with no WHT deducted (Uganda WHT 15%): ${t.vendorName ?? t.description ?? "Unknown"} (UGX ${amt.toLocaleString()})`, severity: "high", estimatedExposure: String(amt * 0.15), status: "open", category: "Withholding Tax" });
        }
      }

      if (newFlags.length > 0) await db.insert(taxRiskFlagsTable).values(newFlags);

      const [co] = await db.select({ tc: companiesTable.transactionCount, ofc: companiesTable.openFlagsCount }).from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
      if (co) {
        await db.update(companiesTable).set({
          transactionCount: (co.tc ?? 0) + validRows.length,
          openFlagsCount: (co.ofc ?? 0) + newFlags.length,
          updatedAt: new Date(),
        }).where(eq(companiesTable.id, companyId));
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
