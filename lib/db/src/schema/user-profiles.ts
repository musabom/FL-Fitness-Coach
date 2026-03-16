import { pgTable, serial, integer, text, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  heightCm: integer("height_cm").notNull(),
  weightKg: real("weight_kg").notNull(),
  targetWeightKg: real("target_weight_kg").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  goalMode: text("goal_mode").notNull(),
  activityLevel: text("activity_level").notNull(),
  trainingDays: integer("training_days").notNull(),
  trainingLocation: text("training_location").notNull(),
  dietaryPreferences: jsonb("dietary_preferences").notNull().default([]),
  injuryFlags: jsonb("injury_flags").notNull().default([]),
  goalOverride: boolean("goal_override").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
