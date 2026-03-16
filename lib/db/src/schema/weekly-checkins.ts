import { pgTable, serial, integer, text, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { plansTable } from "./plans";

export const weeklyCheckinsTable = pgTable("weekly_checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  weekNumber: integer("week_number").notNull(),
  weightKg: real("weight_kg"),
  waistCm: real("waist_cm"),
  photoFrontUrl: text("photo_front_url"),
  photoSideLeftUrl: text("photo_side_left_url"),
  photoSideRightUrl: text("photo_side_right_url"),
  bfEstimateLow: real("bf_estimate_low"),
  bfEstimateMid: real("bf_estimate_mid"),
  bfEstimateHigh: real("bf_estimate_high"),
  bfConfidence: text("bf_confidence"),
  energyScore: integer("energy_score"),
  sleepScore: integer("sleep_score"),
  mealCompliancePct: real("meal_compliance_pct"),
  trainingCompliancePct: real("training_compliance_pct"),
  scenarioDetected: text("scenario_detected"),
  aiInterpretation: text("ai_interpretation"),
  adjustmentRecommended: boolean("adjustment_recommended"),
  adjustmentApprovedAt: timestamp("adjustment_approved_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});
