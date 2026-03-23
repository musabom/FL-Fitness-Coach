import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coachServicesTable = pgTable("coach_services", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 3 }),
  specializations: text("specializations").array().notNull().default([]),
  activeOffer: text("active_offer"),
  beforeAfterPhotos: text("before_after_photos").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoachServiceSchema = createInsertSchema(coachServicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCoachService = z.infer<typeof insertCoachServiceSchema>;
export type CoachService = typeof coachServicesTable.$inferSelect;
