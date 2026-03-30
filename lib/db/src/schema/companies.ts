import { pgTable, text, timestamp, uuid, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  tinOrTaxId: text("tin_or_tax_id"),
  industry: text("industry"),
  country: text("country"),
  financialYear: text("financial_year"),
  riskLevel: text("risk_level"),
  riskScore: numeric("risk_score"),
  transactionCount: integer("transaction_count").default(0),
  openFlagsCount: integer("open_flags_count").default(0),
  estimatedExposure: numeric("estimated_exposure").default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
