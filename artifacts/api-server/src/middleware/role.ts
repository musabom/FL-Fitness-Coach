import type { Request, Response } from "express";
import { pool } from "@workspace/db";

export function requireAuth(req: Request, res: Response): number | null {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.userId;
}

export async function requireAdmin(req: Request, res: Response): Promise<number | null> {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const result = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  if (!result.rows[0] || result.rows[0].role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return userId;
}

export async function requireCoachOrAdmin(req: Request, res: Response): Promise<{ userId: number; role: string } | null> {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  const result = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  const role = result.rows[0]?.role;
  if (role !== "coach" && role !== "admin") {
    res.status(403).json({ error: "Coach or admin access required" });
    return null;
  }
  return { userId, role };
}

/**
 * Resolves the effective user ID for data access.
 * - Default: returns the session userId (member sees own data)
 * - If ?clientId= is set and the caller is a coach with that client assigned, returns clientId
 * - If ?clientId= is set and the caller is admin, allows any clientId
 */
export async function resolveTargetUserId(req: Request, res: Response): Promise<number | null> {
  const sessionUserId = requireAuth(req, res);
  if (!sessionUserId) return null;

  const clientIdParam = req.query["clientId"] as string | undefined;
  if (!clientIdParam) return sessionUserId;

  const clientId = parseInt(clientIdParam, 10);
  if (isNaN(clientId)) {
    res.status(400).json({ error: "Invalid clientId" });
    return null;
  }

  const callerResult = await pool.query(`SELECT role FROM users WHERE id = $1`, [sessionUserId]);
  const callerRole = callerResult.rows[0]?.role;

  if (callerRole === "admin") return clientId;

  if (callerRole === "coach") {
    const assignedResult = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND coach_id = $2`,
      [clientId, sessionUserId]
    );
    if (assignedResult.rows.length === 0) {
      res.status(403).json({ error: "You are not the coach of this client" });
      return null;
    }
    return clientId;
  }

  res.status(403).json({ error: "Not authorized to access this client's data" });
  return null;
}

export async function getCallerRole(userId: number): Promise<string> {
  const result = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
  return result.rows[0]?.role ?? "member";
}
