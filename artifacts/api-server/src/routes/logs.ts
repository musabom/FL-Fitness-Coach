import { Router, type IRouter } from "express";
import { db, clickLogsTable, usersTable } from "@workspace/db";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.post("/logs/events", async (req, res): Promise<void> => {
  try {
    const sessionUserId: number | undefined = req.session.userId;
    const events = Array.isArray(req.body) ? req.body : [req.body];

    if (!events.length) {
      res.status(400).json({ error: "No events provided" });
      return;
    }

    const rows = events.slice(0, 50).map((e: any) => ({
      userId: sessionUserId ?? null,
      sessionId: typeof e.sessionId === "string" ? e.sessionId.slice(0, 64) : null,
      eventType: typeof e.eventType === "string" ? e.eventType.slice(0, 32) : "click",
      elementTag: typeof e.elementTag === "string" ? e.elementTag.slice(0, 64) : null,
      elementText: typeof e.elementText === "string" ? e.elementText.slice(0, 200) : null,
      elementId: typeof e.elementId === "string" ? e.elementId.slice(0, 128) : null,
      elementClass: typeof e.elementClass === "string" ? e.elementClass.slice(0, 256) : null,
      page: typeof e.page === "string" ? e.page.slice(0, 256) : null,
      metadata: e.metadata && typeof e.metadata === "object" ? e.metadata : null,
    }));

    await db.insert(clickLogsTable).values(rows);
    res.status(201).json({ logged: rows.length });
  } catch (err) {
    console.error("Failed to log events:", err);
    res.status(500).json({ error: "Failed to log events" });
  }
});

router.get("/admin/logs", async (req, res): Promise<void> => {
  try {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const callerRes = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.session.userId]);
    if (callerRes.rows[0]?.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }

    const page = Math.max(1, parseInt(req.query["page"] as string || "1", 10));
    const limit = Math.min(100, parseInt(req.query["limit"] as string || "50", 10));
    const offset = (page - 1) * limit;
    const userId = req.query["userId"] ? parseInt(req.query["userId"] as string, 10) : null;
    const since = req.query["since"] as string | undefined;

    const conditions = [];
    if (userId) conditions.push(eq(clickLogsTable.userId, userId));
    if (since) conditions.push(gte(clickLogsTable.createdAt, new Date(since)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db.select({
        id: clickLogsTable.id,
        userId: clickLogsTable.userId,
        sessionId: clickLogsTable.sessionId,
        eventType: clickLogsTable.eventType,
        elementTag: clickLogsTable.elementTag,
        elementText: clickLogsTable.elementText,
        elementId: clickLogsTable.elementId,
        page: clickLogsTable.page,
        metadata: clickLogsTable.metadata,
        createdAt: clickLogsTable.createdAt,
        userName: usersTable.fullName,
        userEmail: usersTable.email,
      })
        .from(clickLogsTable)
        .leftJoin(usersTable, eq(clickLogsTable.userId, usersTable.id))
        .where(whereClause)
        .orderBy(desc(clickLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(clickLogsTable)
        .where(whereClause),
    ]);

    res.json({
      logs,
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    });
  } catch (err) {
    console.error("Failed to fetch logs:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

router.delete("/admin/logs", async (req, res): Promise<void> => {
  try {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const callerRes = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.session.userId]);
    if (callerRes.rows[0]?.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }

    const olderThanDays = parseInt(req.query["olderThanDays"] as string || "30", 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await pool.query(
      `DELETE FROM click_logs WHERE created_at < $1`,
      [cutoff]
    );

    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error("Failed to clear logs:", err);
    res.status(500).json({ error: "Failed to clear logs" });
  }
});

export default router;
