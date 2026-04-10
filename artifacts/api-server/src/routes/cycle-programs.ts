import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: import("express").Request, res: import("express").Response): number | null {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return (res.locals["userId"] as number | undefined) ?? req.session.userId;
}

// ── GET /cycle-programs ───────────────────────────────────────────────────────
// Returns all cycle programs for the user, each with their slots populated.

router.get("/cycle-programs", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const programsRes = await pool.query(
    `SELECT * FROM cycle_programs WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  if (programsRes.rows.length === 0) {
    res.json([]);
    return;
  }

  const programIds = programsRes.rows.map((r: any) => r.id);
  const slotsRes = await pool.query(
    `SELECT cps.*, uw.workout_name
     FROM cycle_program_slots cps
     LEFT JOIN user_workouts uw ON uw.id = cps.workout_id
     WHERE cps.program_id = ANY($1)
     ORDER BY cps.program_id, cps.position`,
    [programIds]
  );

  const slotsByProgram: Record<number, any[]> = {};
  for (const s of slotsRes.rows) {
    if (!slotsByProgram[s.program_id]) slotsByProgram[s.program_id] = [];
    slotsByProgram[s.program_id].push(s);
  }

  const result = programsRes.rows.map((p: any) => ({
    ...p,
    slots: slotsByProgram[p.id] || [],
  }));

  res.json(result);
});

// ── POST /cycle-programs ──────────────────────────────────────────────────────
// Create a new cycle program.

router.post("/cycle-programs", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { name, start_date, cycle_length } = req.body as {
    name?: string;
    start_date?: string;
    cycle_length?: number;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    res.status(400).json({ error: "start_date (YYYY-MM-DD) is required" });
    return;
  }
  const len = Number(cycle_length);
  if (!len || len < 1 || len > 14) {
    res.status(400).json({ error: "cycle_length must be between 1 and 14" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO cycle_programs (user_id, name, start_date, cycle_length)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, name.trim(), start_date, len]
  );

  // Auto-create empty slots
  const prog = result.rows[0];
  for (let i = 0; i < len; i++) {
    await pool.query(
      `INSERT INTO cycle_program_slots (program_id, position) VALUES ($1, $2)
       ON CONFLICT (program_id, position) DO NOTHING`,
      [prog.id, i]
    );
  }

  // Return with slots
  const slotsRes = await pool.query(
    `SELECT cps.*, uw.workout_name
     FROM cycle_program_slots cps
     LEFT JOIN user_workouts uw ON uw.id = cps.workout_id
     WHERE cps.program_id = $1 ORDER BY cps.position`,
    [prog.id]
  );

  res.status(201).json({ ...prog, slots: slotsRes.rows });
});

// ── PATCH /cycle-programs/:id ─────────────────────────────────────────────────
// Update program metadata (name, start_date, cycle_length, is_active).

router.patch("/cycle-programs/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const progId = Number(req.params["id"]);
  const { name, start_date, cycle_length, is_active } = req.body as {
    name?: string;
    start_date?: string;
    cycle_length?: number;
    is_active?: boolean;
  };

  // Fetch existing
  const existing = await pool.query(
    `SELECT * FROM cycle_programs WHERE id = $1 AND user_id = $2`,
    [progId, userId]
  );
  if (!existing.rows.length) {
    res.status(404).json({ error: "Program not found" });
    return;
  }

  const current = existing.rows[0];
  const newName = name?.trim() ?? current.name;
  const newStartDate = start_date ?? current.start_date;
  const newCycleLength = cycle_length !== undefined ? Number(cycle_length) : Number(current.cycle_length);
  const newIsActive = is_active !== undefined ? is_active : current.is_active;

  if (newCycleLength < 1 || newCycleLength > 14) {
    res.status(400).json({ error: "cycle_length must be between 1 and 14" });
    return;
  }

  await pool.query(
    `UPDATE cycle_programs SET name = $1, start_date = $2, cycle_length = $3, is_active = $4
     WHERE id = $5 AND user_id = $6`,
    [newName, newStartDate, newCycleLength, newIsActive, progId, userId]
  );

  // If cycle_length changed, reconcile slots
  const oldLen = Number(current.cycle_length);
  if (newCycleLength !== oldLen) {
    if (newCycleLength > oldLen) {
      // Add missing slots
      for (let i = oldLen; i < newCycleLength; i++) {
        await pool.query(
          `INSERT INTO cycle_program_slots (program_id, position) VALUES ($1, $2)
           ON CONFLICT (program_id, position) DO NOTHING`,
          [progId, i]
        );
      }
    } else {
      // Remove slots beyond new length
      await pool.query(
        `DELETE FROM cycle_program_slots WHERE program_id = $1 AND position >= $2`,
        [progId, newCycleLength]
      );
    }
  }

  const updated = await pool.query(`SELECT * FROM cycle_programs WHERE id = $1`, [progId]);
  const slotsRes = await pool.query(
    `SELECT cps.*, uw.workout_name
     FROM cycle_program_slots cps
     LEFT JOIN user_workouts uw ON uw.id = cps.workout_id
     WHERE cps.program_id = $1 ORDER BY cps.position`,
    [progId]
  );

  res.json({ ...updated.rows[0], slots: slotsRes.rows });
});

// ── DELETE /cycle-programs/:id ────────────────────────────────────────────────

router.delete("/cycle-programs/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  await pool.query(
    `DELETE FROM cycle_programs WHERE id = $1 AND user_id = $2`,
    [req.params["id"], userId]
  );
  res.json({ ok: true });
});

// ── PUT /cycle-programs/:id/slots ─────────────────────────────────────────────
// Assign workouts to slots. Body: { slots: [{ position, workout_id, label }] }

router.put("/cycle-programs/:id/slots", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const progId = Number(req.params["id"]);
  const check = await pool.query(
    `SELECT id, cycle_length FROM cycle_programs WHERE id = $1 AND user_id = $2`,
    [progId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Program not found" });
    return;
  }

  const cycleLength = Number(check.rows[0].cycle_length);
  const slots: Array<{ position: number; workout_id?: number | null; label?: string }> =
    req.body.slots ?? [];

  for (const slot of slots) {
    const pos = Number(slot.position);
    if (pos < 0 || pos >= cycleLength) continue;

    // Verify workout ownership if provided
    if (slot.workout_id) {
      const ownerCheck = await pool.query(
        `SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2`,
        [slot.workout_id, userId]
      );
      if (!ownerCheck.rows.length) continue;
    }

    await pool.query(
      `INSERT INTO cycle_program_slots (program_id, position, workout_id, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (program_id, position) DO UPDATE
         SET workout_id = EXCLUDED.workout_id,
             label = EXCLUDED.label`,
      [progId, pos, slot.workout_id ?? null, slot.label ?? null]
    );
  }

  const slotsRes = await pool.query(
    `SELECT cps.*, uw.workout_name
     FROM cycle_program_slots cps
     LEFT JOIN user_workouts uw ON uw.id = cps.workout_id
     WHERE cps.program_id = $1 ORDER BY cps.position`,
    [progId]
  );

  res.json({ program_id: progId, slots: slotsRes.rows });
});

// ── POST /cycle-programs/:id/exclusions ───────────────────────────────────────
// Exclude a specific date from a cycle program (skip that day).

router.post("/cycle-programs/:id/exclusions", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const progId = Number(req.params["id"]);
  const { date } = req.body as { date?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
    return;
  }

  const check = await pool.query(
    `SELECT id FROM cycle_programs WHERE id = $1 AND user_id = $2`,
    [progId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Program not found" });
    return;
  }

  await pool.query(
    `INSERT INTO cycle_program_exclusions (user_id, program_id, date)
     VALUES ($1, $2, $3) ON CONFLICT (user_id, program_id, date) DO NOTHING`,
    [userId, progId, date]
  );

  res.json({ program_id: progId, date, excluded: true });
});

// ── DELETE /cycle-programs/:id/exclusions ─────────────────────────────────────
// Remove an exclusion (re-include the date).

router.delete("/cycle-programs/:id/exclusions", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const progId = Number(req.params["id"]);
  const date = req.query["date"] as string;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date query param (YYYY-MM-DD) is required" });
    return;
  }

  await pool.query(
    `DELETE FROM cycle_program_exclusions WHERE user_id = $1 AND program_id = $2 AND date = $3`,
    [userId, progId, date]
  );

  res.json({ program_id: progId, date, excluded: false });
});

export default router;
