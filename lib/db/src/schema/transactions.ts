import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  uploadId: uuid("upload_id"),
  transactionDate: text("transaction_date"),
  description: text("description"),
  reference: text("reference"),
  amount: numeric("amount"),
  currency: text("currency"),
  accountCode: text("account_code"),
  accountCategory: text("account_category"),
  vendorName: text("vendor_name"),
  customerName: text("customer_name"),
  taxType: text("tax_type"),
  vatAmount: numeric("vat_amount"),
  withholdingTaxAmount: numeric("withholding_tax_amount"),
  transactionType: text("transaction_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
