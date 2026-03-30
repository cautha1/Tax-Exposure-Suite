import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  transactionsTable,
  uploadsTable,
  taxRiskFlagsTable,
  companiesTable,
} from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

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

    const [rows, totalResult] = await Promise.all([
      db.select().from(transactionsTable).where(where).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(transactionsTable).where(where),
    ]);

    res.json({
      data: rows.map((t) => ({
        id: t.id,
        companyId: t.companyId,
        transactionDate: t.transactionDate ?? null,
        description: t.description ?? null,
        reference: t.reference ?? null,
        amount: t.amount ? Number(t.amount) : null,
        currency: t.currency ?? null,
        accountCode: t.accountCode ?? null,
        accountCategory: t.accountCategory ?? null,
        vendorName: t.vendorName ?? null,
        customerName: t.customerName ?? null,
        taxType: t.taxType ?? null,
        vatAmount: t.vatAmount ? Number(t.vatAmount) : null,
        withholdingTaxAmount: t.withholdingTaxAmount ? Number(t.withholdingTaxAmount) : null,
        transactionType: t.transactionType ?? null,
        createdAt: t.createdAt,
      })),
      total: Number(totalResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/transactions/upload", async (req, res) => {
  try {
    const { companyId, transactions, fileName } = req.body;
    if (!companyId || !transactions || !Array.isArray(transactions)) {
      res.status(400).json({ error: "companyId and transactions array required" });
      return;
    }

    const upload = await db.insert(uploadsTable).values({
      companyId,
      fileName: fileName || "upload.csv",
      rowCount: transactions.length,
      status: "completed",
    }).returning();

    const uploadId = upload[0].id;

    if (transactions.length > 0) {
      const rows = transactions.map((t: Record<string, string>) => ({
        companyId,
        uploadId,
        transactionDate: t.transaction_date || null,
        description: t.description || null,
        reference: t.reference || null,
        amount: t.amount ? t.amount.toString() : null,
        currency: t.currency || "USD",
        accountCode: t.account_code || null,
        accountCategory: t.account_category || null,
        vendorName: t.vendor_name || null,
        customerName: t.customer_name || null,
        taxType: t.tax_type || null,
        vatAmount: t.vat_amount ? t.vat_amount.toString() : null,
        withholdingTaxAmount: t.withholding_tax_amount ? t.withholding_tax_amount.toString() : null,
        transactionType: t.transaction_type || null,
      }));

      await db.insert(transactionsTable).values(rows);

      await db.update(companiesTable)
        .set({ transactionCount: sql`transaction_count + ${transactions.length}` })
        .where(eq(companiesTable.id, companyId));

      const riskFlags = [];
      for (const t of rows) {
        if (Number(t.vatAmount) === 0 && t.taxType === "VAT") {
          riskFlags.push({
            companyId,
            transactionId: null,
            ruleCode: "VAT-001",
            description: `Zero VAT on transaction: ${t.description ?? t.reference}`,
            severity: "medium",
            estimatedExposure: (Number(t.amount) * 0.075).toString(),
            status: "open",
            category: "VAT",
          });
        }
        if (Number(t.withholdingTaxAmount) === 0 && t.taxType === "WHT") {
          riskFlags.push({
            companyId,
            transactionId: null,
            ruleCode: "WHT-001",
            description: `Missing withholding tax: ${t.description ?? t.reference}`,
            severity: "high",
            estimatedExposure: (Number(t.amount) * 0.05).toString(),
            status: "open",
            category: "Withholding Tax",
          });
        }
      }
      if (riskFlags.length > 0) {
        await db.insert(taxRiskFlagsTable).values(riskFlags);
        await db.update(companiesTable)
          .set({ openFlagsCount: sql`open_flags_count + ${riskFlags.length}` })
          .where(eq(companiesTable.id, companyId));
      }
    }

    res.json({
      uploadId,
      rowsImported: transactions.length,
      message: `Successfully imported ${transactions.length} transactions`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
