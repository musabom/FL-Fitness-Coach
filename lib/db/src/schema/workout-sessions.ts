import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { plansTable } from "./plans";

export const workoutSessionsTable = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  sessionType: text("session_type").notNull(),
  muscleGroups: jsonb("muscle_groups"),
  setsLogged: jsonb("sets_logged"),
  durationMins: integer("duration_mins"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});
