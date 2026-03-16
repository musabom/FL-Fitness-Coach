import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { weeklyCheckinsTable } from "./weekly-checkins";
import { plansTable } from "./plans";

export const adjustmentLogsTable = pgTable("adjustment_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  checkinId: integer("checkin_id").references(() => weeklyCheckinsTable.id),
  oldPlanId: integer("old_plan_id").references(() => plansTable.id),
  newPlanId: integer("new_plan_id").references(() => plansTable.id),
  triggerScenario: text("trigger_scenario").notNull(),
  variableChanged: text("variable_changed").notNull(),
  changeDescription: text("change_description").notNull(),
  approvedByUser: boolean("approved_by_user"),
  deferCount: integer("defer_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
