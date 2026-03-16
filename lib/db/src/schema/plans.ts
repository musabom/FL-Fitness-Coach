import { pgTable, serial, integer, text, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  version: integer("version").notNull().default(1),
  phase: text("phase").notNull(),
  calorieTarget: integer("calorie_target").notNull(),
  proteinG: integer("protein_g").notNull(),
  carbsG: integer("carbs_g").notNull(),
  fatG: integer("fat_g").notNull(),
  tdeeEstimated: integer("tdee_estimated").notNull(),
  deficitSurplusKcal: integer("deficit_surplus_kcal").notNull(),
  bfEstimatePct: real("bf_estimate_pct"),
  bfSource: text("bf_source").notNull().default("proxy_deurenberg"),
  trainingSplit: text("training_split"),
  weeksInDeficit: integer("weeks_in_deficit").notNull().default(0),
  dietBreakDue: boolean("diet_break_due").notNull().default(false),
  trigger: text("trigger").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
