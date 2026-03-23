import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coachProfilesTable = pgTable("coach_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  photoUrl: text("photo_url"),
  specializations: text("specializations").array().notNull().default([]),
  pricePerMonth: numeric("price_per_month", { precision: 10, scale: 3 }),
  bio: text("bio"),
  activeOffer: text("active_offer"),
  beforeAfterPhotos: text("before_after_photos").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoachProfileSchema = createInsertSchema(coachProfilesTable).omit({ id: true, updatedAt: true });
export type InsertCoachProfile = z.infer<typeof insertCoachProfileSchema>;
export type CoachProfile = typeof coachProfilesTable.$inferSelect;
