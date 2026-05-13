import { jsonb, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const uploadsTable = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  fileName: text("file_name"),
  rowCount: integer("row_count"),
  totalRows: integer("total_rows").default(0),
  validRows: integer("valid_rows").default(0),
  failedRows: integer("failed_rows").default(0),
  duplicateRows: integer("duplicate_rows").default(0),
  status: text("status").default("pending"),
  errorSummary: jsonb("error_summary").default([]).notNull(),
  uploadedBy: uuid("uploaded_by"),
  advisorId: uuid("advisor_id"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUploadSchema = createInsertSchema(uploadsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Upload = typeof uploadsTable.$inferSelect;
