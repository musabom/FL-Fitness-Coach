import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const clickLogsTable = pgTable("click_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  sessionId: text("session_id"),
  eventType: text("event_type").notNull().default("click"),
  elementTag: text("element_tag"),
  elementText: text("element_text"),
  elementId: text("element_id"),
  elementClass: text("element_class"),
  page: text("page"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClickLog = typeof clickLogsTable.$inferSelect;
