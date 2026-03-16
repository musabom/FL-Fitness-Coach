import { pgTable, serial, integer, text, boolean, timestamp, jsonb, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const genderEnum = pgEnum("gender", ["male", "female", "prefer_not_to_say"]);
export const goalModeEnum = pgEnum("goal_mode", ["cut", "recomposition", "lean_bulk", "maintenance"]);
export const activityLevelEnum = pgEnum("activity_level", ["sedentary", "lightly_active", "moderately_active", "very_active"]);
export const trainingLocationEnum = pgEnum("training_location", ["gym", "home", "both"]);

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  heightCm: integer("height_cm").notNull(),
  weightKg: real("weight_kg").notNull(),
  targetWeightKg: real("target_weight_kg").notNull(),
  age: integer("age").notNull(),
  gender: genderEnum("gender").notNull(),
  goalMode: goalModeEnum("goal_mode").notNull(),
  activityLevel: activityLevelEnum("activity_level").notNull(),
  trainingDays: integer("training_days").notNull(),
  trainingLocation: trainingLocationEnum("training_location").notNull(),
  dietaryPreferences: jsonb("dietary_preferences").notNull().default([]),
  injuryFlags: jsonb("injury_flags").notNull().default([]),
  goalOverride: boolean("goal_override").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
