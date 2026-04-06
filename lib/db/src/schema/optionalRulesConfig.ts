import { pgTable, text, timestamp, uuid, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const optionalRulesConfigTable = pgTable("optional_rules_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id"),
  ruleCode: text("rule_code").notNull(),
  ruleName: text("rule_name").notNull(),
  category: text("category"),
  enabled: boolean("enabled").notNull().default(true),
  threshold: numeric("threshold"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOptionalRulesConfigSchema = createInsertSchema(optionalRulesConfigTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOptionalRulesConfig = z.infer<typeof insertOptionalRulesConfigSchema>;
export type OptionalRulesConfig = typeof optionalRulesConfigTable.$inferSelect;
