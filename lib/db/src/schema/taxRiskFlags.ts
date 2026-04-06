import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taxRiskFlagsTable = pgTable("tax_risk_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  transactionId: uuid("transaction_id"),
  ruleCode: text("rule_code"),
  riskType: text("risk_type"),
  description: text("description"),
  severity: text("severity"),
  estimatedExposure: numeric("estimated_exposure"),
  status: text("status").default("open"),
  category: text("category"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: uuid("reviewed_by"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaxRiskFlagSchema = createInsertSchema(taxRiskFlagsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTaxRiskFlag = z.infer<typeof insertTaxRiskFlagSchema>;
export type TaxRiskFlag = typeof taxRiskFlagsTable.$inferSelect;
