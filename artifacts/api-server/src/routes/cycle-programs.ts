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

// ── Helper: get or create the user's default cycle ────────────────────────────

async function getOrCreateDefaultCycle(userId: number): Promise<any> {
  const existing = await pool.query(
    `SELECT * FROM cycle_programs WHERE user_id = $1 AND is_default = TRUE LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const today = new Date().toISOString().slice(0, 10);
  const created = await pool.query(
    `INSERT INTO cycle_programs (user_id, name, start_date, cycle_length, is_default, is_active)
     VALUES ($1, 'My Cycle', $2, 1, TRUE, TRUE) RETURNING *`,
    [userId, today]
  );
  return created.rows[0];
}

async function getCycleWithSlots(progId: number, userId: number, trainingMode: string) {
  const slotsRes = await pool.query(
    `SELECT cps.*, uw.workout_name
     FROM cycle_program_slots cps
     LEFT JOIN user_workouts uw ON uw.id = cps.workout_id
     WHERE cps.program_id = $1 ORDER BY cps.position`,
    [progId]
  );
  const prog = await pool.query(`SELECT * FROM cycle_programs WHERE id = $1`, [progId]);
  return { ...prog.rows[0], slots: slotsRes.rows, training_mode: trainingMode };
}

// ── GET /user-cycle ───────────────────────────────────────────────────────────

router.get("/user-cycle", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const prog = await getOrCreateDefaultCycle(userId);
    const modeRes = await pool.query(
      `SELECT COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const trainingMode = modeRes.rows[0]?.training_mode ?? 'schedule';
    const result = await getCycleWithSlots(prog.id, userId, trainingMode);
    res.json(result);
  } catch (err) {
    console.error("GET /user-cycle error:", err);
    res.status(500).json({ error: "Failed to load cycle" });
  }
});

// ── POST /user-cycle/workouts — add workout to cycle ──────────────────────────

router.post("/user-cycle/workouts", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { workout_id } = req.body as { workout_id?: number };
    if (!workout_id) { res.status(400).json({ error: "workout_id is required" }); return; }

    const ownerCheck = await pool.query(
      `SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2`,
      [workout_id, userId]
    );
    if (!ownerCheck.rows.length) { res.status(404).json({ error: "Workout not found" }); return; }

    const prog = await getOrCreateDefaultCycle(userId);

    const alreadyIn = await pool.query(
      `SELECT position FROM cycle_program_slots WHERE program_id = $1 AND workout_id = $2`,
      [prog.id, workout_id]
    );
    if (alreadyIn.rows.length > 0) {
      res.status(409).json({ error: "Already in cycle", position: alreadyIn.rows[0].position });
      return;
    }

    const maxPosRes = await pool.query(
      `SELECT COALESCE(MAX(position), -1) as max_pos FROM cycle_program_slots WHERE program_id = $1`,
      [prog.id]
    );
    const nextPos = Number(maxPosRes.rows[0].max_pos) + 1;

    await pool.query(
      `INSERT INTO cycle_program_slots (program_id, position, workout_id) VALUES ($1, $2, $3)`,
      [prog.id, nextPos, workout_id]
    );
    await pool.query(
      `UPDATE cycle_programs SET cycle_length = $1 WHERE id = $2`,
      [nextPos + 1, prog.id]
    );

    const modeRes = await pool.query(
      `SELECT COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const trainingMode = modeRes.rows[0]?.training_mode ?? 'schedule';
    const result = await getCycleWithSlots(prog.id, userId, trainingMode);
    res.json({ position: nextPos, ...result });
  } catch (err) {
    console.error("POST /user-cycle/workouts error:", err);
    res.status(500).json({ error: "Failed to add workout to cycle" });
  }
});

// ── DELETE /user-cycle/workouts/:workoutId ────────────────────────────────────

router.delete("/user-cycle/workouts/:workoutId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const workoutId = Number(req.params["workoutId"]);
    const prog = await getOrCreateDefaultCycle(userId);

    await pool.query(
      `DELETE FROM cycle_program_slots WHERE program_id = $1 AND workout_id = $2`,
      [prog.id, workoutId]
    );

    const remaining = await pool.query(
      `SELECT id FROM cycle_program_slots WHERE program_id = $1 ORDER BY position`,
      [prog.id]
    );
    for (let i = 0; i < remaining.rows.length; i++) {
      await pool.query(
        `UPDATE cycle_program_slots SET position = $1 WHERE id = $2`,
        [i, remaining.rows[i].id]
      );
    }
    await pool.query(
      `UPDATE cycle_programs SET cycle_length = $1 WHERE id = $2`,
      [Math.max(remaining.rows.length, 1), prog.id]
    );

    const modeRes = await pool.query(
      `SELECT COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const trainingMode = modeRes.rows[0]?.training_mode ?? 'schedule';
    const result = await getCycleWithSlots(prog.id, userId, trainingMode);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("DELETE /user-cycle/workouts error:", err);
    res.status(500).json({ error: "Failed to remove workout from cycle" });
  }
});

// ── POST /user-cycle/rest — append a rest day to the user's default cycle ─────

router.post("/user-cycle/rest", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const prog = await getOrCreateDefaultCycle(userId);

    const maxPosRes = await pool.query(
      `SELECT COALESCE(MAX(position), -1) as max_pos FROM cycle_program_slots WHERE program_id = $1`,
      [prog.id]
    );
    const nextPos = Number(maxPosRes.rows[0].max_pos) + 1;

    await pool.query(
      `INSERT INTO cycle_program_slots (program_id, position, workout_id) VALUES ($1, $2, NULL)`,
      [prog.id, nextPos]
    );
    await pool.query(
      `UPDATE cycle_programs SET cycle_length = $1 WHERE id = $2`,
      [nextPos + 1, prog.id]
    );

    const modeRes = await pool.query(
      `SELECT COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const trainingMode = modeRes.rows[0]?.training_mode ?? 'schedule';
    const result = await getCycleWithSlots(prog.id, userId, trainingMode);
    res.json({ position: nextPos, ...result });
  } catch (err) {
    console.error("POST /user-cycle/rest error:", err);
    res.status(500).json({ error: "Failed to add rest day" });
  }
});

// ── DELETE /user-cycle/rest/:position — remove a rest day slot and re-index ───

router.delete("/user-cycle/rest/:position", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const position = Number(req.params["position"]);
    const prog = await getOrCreateDefaultCycle(userId);

    // Only delete if the slot at this position is actually a rest day (workout_id IS NULL)
    const deleted = await pool.query(
      `DELETE FROM cycle_program_slots WHERE program_id = $1 AND position = $2 AND workout_id IS NULL RETURNING id`,
      [prog.id, position]
    );
    if (deleted.rows.length === 0) {
      res.status(404).json({ error: "No rest day at that position" });
      return;
    }

    // Re-index remaining slots to close the gap
    const remaining = await pool.query(
      `SELECT id FROM cycle_program_slots WHERE program_id = $1 ORDER BY position`,
      [prog.id]
    );
    for (let i = 0; i < remaining.rows.length; i++) {
      await pool.query(`UPDATE cycle_program_slots SET position = $1 WHERE id = $2`, [i, remaining.rows[i].id]);
    }
    await pool.query(
      `UPDATE cycle_programs SET cycle_length = $1 WHERE id = $2`,
      [Math.max(remaining.rows.length, 1), prog.id]
    );

    const modeRes = await pool.query(
      `SELECT COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const trainingMode = modeRes.rows[0]?.training_mode ?? 'schedule';
    const result = await getCycleWithSlots(prog.id, userId, trainingMode);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("DELETE /user-cycle/rest error:", err);
    res.status(500).json({ error: "Failed to remove rest day" });
  }
});

// ── PUT /user-cycle/reorder ───────────────────────────────────────────────────

router.put("/user-cycle/reorder", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { ordered_workout_ids } = req.body as { ordered_workout_ids?: number[] };
    if (!Array.isArray(ordered_workout_ids)) {
      res.status(400).json({ error: "ordered_workout_ids array is required" });
      return;
    }

    const prog = await getOrCreateDefaultCycle(userId);

    // First pass: shift all positions to a high temp range to avoid unique constraint conflicts
    await pool.query(
      `UPDATE cycle_program_slots SET position = position + 10000 WHERE program_id = $1`,
      [prog.id]
    );
    // Second pass: assign real positions
    for (let i = 0; i < ordered_workout_ids.length; i++) {
      await pool.query(
        `UPDATE cycle_program_slots SET position = $1 WHERE program_id = $2 AND workout_id = $3`,
        [i, prog.id, ordered_workout_ids[i]]
      );
    }
    await pool.query(
      `UPDATE cycle_programs SET cycle_length = $1 WHERE id = $2`,
      [Math.max(ordered_workout_ids.length, 1), prog.id]
    );

    const modeRes = await pool.query(
      `SELECT COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const trainingMode = modeRes.rows[0]?.training_mode ?? 'schedule';
    const result = await getCycleWithSlots(prog.id, userId, trainingMode);
    res.json(result);
  } catch (err) {
    console.error("PUT /user-cycle/reorder error:", err);
    res.status(500).json({ error: "Failed to reorder cycle" });
  }
});

// ── PATCH /user-cycle/start-date ──────────────────────────────────────────────

router.patch("/user-cycle/start-date", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { start_date } = req.body as { start_date?: string };
    console.log("PATCH /user-cycle/start-date body:", req.body, "start_date:", start_date);
    if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
      res.status(400).json({ error: "Valid start_date (YYYY-MM-DD) is required" });
      return;
    }

    const prog = await getOrCreateDefaultCycle(userId);
    await pool.query(
      `UPDATE cycle_programs SET start_date = $1 WHERE id = $2`,
      [start_date, prog.id]
    );
    res.json({ ok: true, start_date });
  } catch (err) {
    console.error("PATCH /user-cycle/start-date error:", err);
    res.status(500).json({ error: "Failed to update start date" });
  }
});

// ── PATCH /training-mode ──────────────────────────────────────────────────────

router.patch("/training-mode", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { mode } = req.body as { mode?: string };
    if (!mode || !["schedule", "cycle"].includes(mode)) {
      res.status(400).json({ error: "mode must be 'schedule' or 'cycle'" });
      return;
    }
    await pool.query(
      `UPDATE user_profiles SET training_mode = $1 WHERE user_id = $2`,
      [mode, userId]
    );
    res.json({ training_mode: mode });
  } catch (err) {
    console.error("PATCH /training-mode error:", err);
    res.status(500).json({ error: "Failed to update training mode" });
  }
});

export default router;
