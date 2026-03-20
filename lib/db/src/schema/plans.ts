import { pgTable, serial, integer, text, boolean, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const planTriggerEnum = pgEnum("plan_trigger", ["onboarding", "manual_edit", "weight_update", "checkin_adjustment"]);

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
  weeklyExpectedChangeKg: real("weekly_expected_change_kg").notNull().default(0),
  weeksEstimateLow: integer("weeks_estimate_low"),
  weeksEstimateHigh: integer("weeks_estimate_high"),
  summaryText: text("summary_text").notNull().default(""),
  snapshotWeightKg: real("snapshot_weight_kg").notNull(),
  snapshotTargetWeightKg: real("snapshot_target_weight_kg").notNull(),
  snapshotGoalMode: text("snapshot_goal_mode").notNull(),
  snapshotActivityLevel: text("snapshot_activity_level").notNull(),
  snapshotHeightCm: integer("snapshot_height_cm").notNull(),
  snapshotAge: integer("snapshot_age").notNull(),
  snapshotGender: text("snapshot_gender").notNull(),
  trainingSplit: text("training_split"),
  weeksInDeficit: integer("weeks_in_deficit").notNull().default(0),
  dietBreakDue: boolean("diet_break_due").notNull().default(false),
  isCustomGoal: boolean("is_custom_goal").notNull().default(false),
  customProteinRate: real("custom_protein_rate"),
  customFatRate: real("custom_fat_rate"),
  customDeficitKcal: integer("custom_deficit_kcal"),
  trigger: planTriggerEnum("trigger").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  coachUpdatedAt: timestamp("coach_updated_at", { withTimezone: true }),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
