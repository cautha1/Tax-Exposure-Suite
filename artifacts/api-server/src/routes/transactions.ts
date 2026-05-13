import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { supabase, toCamel, sbErr, isSchemaDriftError } from "../lib/supabase.js";
import {
  currentUser,
  emptyPaginated,
  getVisibleCompanyIds,
  requireCompanyAccess,
} from "../lib/access.js";
import { writeAuditLog } from "../lib/audit.js";
import { buildRuleContext, runTaxRules, type RuleTransaction } from "../lib/rules-engine.js";

const router: IRouter = Router();

interface Tx {
  id: string; companyId: string; uploadId: string | null;
  transactionDate: string | null; description: string | null; reference: string | null;
  amount: string | number | null; currency: string | null; accountCode: string | null;
  accountCategory: string | null; vendorName: string | null; customerName: string | null;
  taxType: string | null; vatAmount: string | number | null; withholdingTaxAmount: string | number | null;
  transactionType: string | null; sourceRowNumber: number | null; rowHash: string | null;
  validationStatus: string | null; duplicateOfTransactionId: string | null; createdAt: string;
}

interface NormalizedRow {
  source_row_number: number;
  transaction_date: string;
  description: string | null;
  reference: string | null;
  amount: number;
  currency: string;
  account_code: string | null;
  account_category: string | null;
  vendor_name: string | null;
  customer_name: string | null;
  tax_type: string | null;
  vat_amount: number | null;
  withholding_tax_amount: number | null;
  transaction_type: string | null;
  raw_data: Record<string, unknown>;
  row_hash: string;
}

interface RowError {
  row: number;
  errors: string[];
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
  transactionType: t.transactionType ?? null,
  sourceRowNumber: t.sourceRowNumber ?? null,
  rowHash: t.rowHash ?? null,
  validationStatus: t.validationStatus ?? null,
  duplicateOfTransactionId: t.duplicateOfTransactionId ?? null,
  createdAt: t.createdAt,
});

const SORTABLE_COLS: Record<string, string> = {
  transaction_date: "transaction_date",
  amount: "amount",
  description: "description",
  created_at: "created_at",
};

router.get("/transactions", async (req, res) => {
  const user = currentUser(req, res);
  if (!user) return;

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
    if (companyId) {
      if (!(await requireCompanyAccess(req, res, companyId))) return;
      q = q.eq("company_id", companyId);
    } else {
      const visibleCompanyIds = await getVisibleCompanyIds(user);
      if (visibleCompanyIds && visibleCompanyIds.length === 0) {
        res.json(emptyPaginated(pageNum, limitNum));
        return;
      }
      if (visibleCompanyIds) q = q.in("company_id", visibleCompanyIds);
    }
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

const REQUIRED_COLS = ["transaction_date", "amount", "currency"];
const ALLOWED_TAX_TYPES = new Set(["VAT", "WHT", "PAYE", "NONE", ""]);
const ALLOWED_TRANSACTION_TYPES = new Set(["debit", "credit", "expense", "revenue", ""]);

function clean(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function parseNumber(value: unknown): number | null {
  const text = clean(value);
  if (text == null) return null;
  const normalized = text.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function hashRow(companyId: string, row: Omit<NormalizedRow, "row_hash">): string {
  const parts = [
    companyId,
    row.transaction_date,
    row.amount.toFixed(2),
    row.currency.toUpperCase(),
    row.reference?.toLowerCase() ?? "",
    row.description?.toLowerCase() ?? "",
    row.vendor_name?.toLowerCase() ?? "",
    row.customer_name?.toLowerCase() ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function validateAndNormalize(companyId: string, raw: Record<string, unknown>, index: number): { row?: NormalizedRow; error?: RowError } {
  const rowNum = index + 2;
  const missing = REQUIRED_COLS.filter((col) => !(col in raw) || clean(raw[col]) == null);
  const errors = missing.map((col) => `${col} is required`);
  const transactionDate = normalizeDate(raw.transaction_date);
  const amount = parseNumber(raw.amount);
  const vatAmount = parseNumber(raw.vat_amount);
  const whtAmount = parseNumber(raw.withholding_tax_amount);
  const currency = clean(raw.currency)?.toUpperCase() ?? "";
  const taxType = (clean(raw.tax_type)?.toUpperCase() ?? "");
  const transactionType = (clean(raw.transaction_type)?.toLowerCase() ?? "");

  if (!transactionDate) errors.push("transaction_date must be a valid date");
  if (amount == null) errors.push("amount must be a valid number");
  else if (amount < 0) errors.push("amount cannot be negative");
  if (currency.length < 3) errors.push("currency must be a valid 3-letter code");
  if (!ALLOWED_TAX_TYPES.has(taxType)) errors.push("tax_type must be VAT, WHT, PAYE, NONE, or blank");
  if (!ALLOWED_TRANSACTION_TYPES.has(transactionType)) errors.push("transaction_type must be debit, credit, expense, revenue, or blank");
  if (vatAmount != null && vatAmount < 0) errors.push("vat_amount cannot be negative");
  if (whtAmount != null && whtAmount < 0) errors.push("withholding_tax_amount cannot be negative");

  if (errors.length > 0 || amount == null || !transactionDate) {
    return { error: { row: rowNum, errors } };
  }

  const rowWithoutHash = {
    source_row_number: rowNum,
    transaction_date: transactionDate,
    description: clean(raw.description),
    reference: clean(raw.reference),
    amount,
    currency,
    account_code: clean(raw.account_code),
    account_category: clean(raw.account_category),
    vendor_name: clean(raw.vendor_name),
    customer_name: clean(raw.customer_name),
    tax_type: taxType === "NONE" || taxType === "" ? null : taxType,
    vat_amount: vatAmount,
    withholding_tax_amount: whtAmount,
    transaction_type: transactionType || null,
    raw_data: raw,
  };

  return {
    row: {
      ...rowWithoutHash,
      row_hash: hashRow(companyId, rowWithoutHash),
    },
  };
}

router.post("/transactions/upload", async (req, res) => {
  let uploadId: string | null = null;

  try {
    const { companyId, transactions, fileName } = req.body;
    if (!companyId || !Array.isArray(transactions)) {
      res.status(400).json({ error: "companyId and transactions array required" });
      return;
    }
    const user = await requireCompanyAccess(req, res, companyId);
    if (!user) return;
    if (transactions.length === 0) {
      res.status(400).json({ error: "No transactions provided" });
      return;
    }

    const firstRow = transactions[0] as Record<string, unknown>;
    const missingColumns = REQUIRED_COLS.filter((col) => !(col in firstRow));
    if (missingColumns.length > 0) {
      res.status(400).json({ error: `Missing required columns: ${missingColumns.join(", ")}`, required: REQUIRED_COLS });
      return;
    }

    const { data: uploadData, error: uploadErr } = await supabase.from("uploads").insert({
      company_id: companyId,
      file_name: fileName ?? "upload.csv",
      row_count: transactions.length,
      total_rows: transactions.length,
      valid_rows: 0,
      failed_rows: 0,
      duplicate_rows: 0,
      status: "processing",
      uploaded_by: user.id,
      advisor_id: user.id,
      started_at: new Date().toISOString(),
    }).select().single();
    sbErr(uploadErr, "create upload");
    const upload = toCamel<{ id: string }>(uploadData);
    uploadId = upload.id;

    const rowErrors: RowError[] = [];
    const candidateRows: NormalizedRow[] = [];
    (transactions as Record<string, unknown>[]).forEach((raw, index) => {
      const result = validateAndNormalize(companyId, raw, index);
      if (result.error) rowErrors.push(result.error);
      if (result.row) candidateRows.push(result.row);
    });

    const seenHashes = new Map<string, NormalizedRow>();
    const inFileDuplicates: RowError[] = [];
    const uniqueRows: NormalizedRow[] = [];
    for (const row of candidateRows) {
      const previous = seenHashes.get(row.row_hash);
      if (previous) {
        inFileDuplicates.push({ row: row.source_row_number, errors: [`Duplicate of CSV row ${previous.source_row_number}`] });
      } else {
        seenHashes.set(row.row_hash, row);
        uniqueRows.push(row);
      }
    }

    const existingHashMap = new Map<string, string>();
    if (uniqueRows.length > 0) {
      const { data: existingRaw, error: existingErr } = await supabase
        .from("transactions")
        .select("id, row_hash")
        .eq("company_id", companyId)
        .in("row_hash", uniqueRows.map((row) => row.row_hash));
      sbErr(existingErr, "check duplicate transactions");
      for (const row of (existingRaw ?? []) as Array<{ id: string; row_hash: string }>) {
        existingHashMap.set(row.row_hash, row.id);
      }
    }

    const existingDuplicates: RowError[] = [];
    const insertRows = uniqueRows.filter((row) => {
      const duplicateId = existingHashMap.get(row.row_hash);
      if (duplicateId) {
        existingDuplicates.push({ row: row.source_row_number, errors: [`Duplicate of existing transaction ${duplicateId}`] });
        return false;
      }
      return true;
    });

    let insertedRows: RuleTransaction[] = [];
    if (insertRows.length > 0) {
      const rows = insertRows.map((row) => ({
        company_id: companyId,
        upload_id: upload.id,
        transaction_date: row.transaction_date,
        description: row.description,
        reference: row.reference,
        amount: row.amount,
        currency: row.currency,
        account_code: row.account_code,
        account_category: row.account_category,
        vendor_name: row.vendor_name,
        customer_name: row.customer_name,
        tax_type: row.tax_type,
        vat_amount: row.vat_amount,
        withholding_tax_amount: row.withholding_tax_amount,
        transaction_type: row.transaction_type,
        source_row_number: row.source_row_number,
        row_hash: row.row_hash,
        validation_status: "valid",
        raw_data: row.raw_data,
      }));

      const { data: insertedRaw, error: txErr } = await supabase.from("transactions").insert(rows).select("*");
      sbErr(txErr, "insert transactions");
      insertedRows = (insertedRaw ?? []).map((t: unknown) => toCamel<RuleTransaction>(t));
    }

    const { data: rulesRaw } = await supabase
      .from("optional_rules_config")
      .select("*")
      .eq("enabled", true)
      .or(`company_id.eq.${companyId},company_id.is.null`);
    const rulesConfig = (rulesRaw ?? []).map((r: unknown) => toCamel<{ ruleCode: string; threshold: string | null }>(r));
    const { enabledRules, thresholds } = buildRuleContext(rulesConfig);
    const newFlags = runTaxRules(insertedRows, enabledRules, thresholds);

    if (newFlags.length > 0) {
      const { error: flagErr } = await supabase.from("tax_risk_flags").insert(newFlags);
      sbErr(flagErr, "insert flags");
    }

    const duplicateRows = inFileDuplicates.length + existingDuplicates.length;
    const failedRows = rowErrors.length;
    const status = insertRows.length > 0
      ? (failedRows > 0 || duplicateRows > 0 ? "completed_with_warnings" : "completed")
      : "failed";
    const errorSummary = [...rowErrors, ...inFileDuplicates, ...existingDuplicates].slice(0, 100);

    await supabase.from("uploads").update({
      row_count: insertRows.length,
      valid_rows: insertRows.length,
      failed_rows: failedRows,
      duplicate_rows: duplicateRows,
      status,
      error_summary: errorSummary,
      completed_at: new Date().toISOString(),
    }).eq("id", upload.id);

    const { data: coRaw } = await supabase.from("companies").select("transaction_count, open_flags_count").eq("id", companyId).single();
    if (coRaw) {
      const co = toCamel<{ transactionCount: number; openFlagsCount: number }>(coRaw);
      await supabase.from("companies").update({
        transaction_count: (co.transactionCount ?? 0) + insertRows.length,
        open_flags_count: (co.openFlagsCount ?? 0) + newFlags.length,
        updated_at: new Date().toISOString(),
      }).eq("id", companyId);
    }

    await writeAuditLog(req, {
      action: "transactions.uploaded",
      entityType: "upload",
      entityId: upload.id,
      companyId,
      metadata: {
        fileName: fileName ?? "upload.csv",
        totalRows: transactions.length,
        rowsImported: insertRows.length,
        rowsFailed: failedRows,
        duplicateRows,
        flagsGenerated: newFlags.length,
        status,
      },
    });

    res.json({
      uploadId: upload.id,
      status,
      rowsReceived: transactions.length,
      rowsImported: insertRows.length,
      rowsFailed: failedRows,
      duplicateRows,
      flagsGenerated: newFlags.length,
      errors: errorSummary,
      message: `Imported ${insertRows.length} transactions. ${failedRows} failed validation. ${duplicateRows} duplicates skipped. ${newFlags.length} risk indicators generated.`,
    });
  } catch (err) {
    req.log.error(err);
    if (uploadId) {
      await supabase.from("uploads").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_summary: [{ row: 0, errors: ["Import failed during processing"] }],
      }).eq("id", uploadId);
    }
    if (isSchemaDriftError(err)) {
      res.status(503).json({
        error: "Database schema is not ready for ingestion",
        action: "Apply supabase-phase2-phase3-migration.sql, then retry the import.",
      });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
