import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companyUsersTable = pgTable("company_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull().default("member"),
  assignedBy: uuid("assigned_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCompanyUserSchema = createInsertSchema(companyUsersTable).omit({ id: true, createdAt: true });
export type InsertCompanyUser = z.infer<typeof insertCompanyUserSchema>;
export type CompanyUser = typeof companyUsersTable.$inferSelect;
