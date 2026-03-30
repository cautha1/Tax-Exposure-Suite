import { pgTable, text, timestamp, uuid, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  title: text("title"),
  status: text("status").default("ready"),
  summary: text("summary"),
  totalExposure: numeric("total_exposure"),
  highRisks: integer("high_risks").default(0),
  mediumRisks: integer("medium_risks").default(0),
  lowRisks: integer("low_risks").default(0),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
