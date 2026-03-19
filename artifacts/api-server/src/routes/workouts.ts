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

// ── Calorie estimation helpers ─────────────────────────────────────────────────

const EFFORT_MET: Record<string, number> = { light: 3.5, moderate: 5.0, heavy: 6.0 };

function estimateStrengthCalories(sets: number, repsMin: number, repsMax: number, restSecs: number, weightKg: number, effort = "moderate") {
  const avgReps = (repsMin + repsMax) / 2;
  const durationMins = (sets * (avgReps * 3 + restSecs)) / 60;
  const met = EFFORT_MET[effort] ?? EFFORT_MET.moderate;
  return +(met * weightKg * (durationMins / 60)).toFixed(1);
}

function estimateCardioCalories(metValue: number, durationMins: number, weightKg: number) {
  return +(metValue * weightKg * (durationMins / 60)).toFixed(1);
}

function estimateStrengthDuration(sets: number, repsMin: number, repsMax: number, restSecs: number): number {
  const avgReps = (repsMin + repsMax) / 2;
  return (sets * (avgReps * 3 + restSecs)) / 60;
}

// ── Build workout objects from DB rows ─────────────────────────────────────────

function buildWorkouts(workoutRows: any[], exerciseRows: any[], scheduleRows: any[], weightKg: number) {
  const scheduleByWorkout: Record<number, string[]> = {};
  for (const s of scheduleRows) {
    if (!scheduleByWorkout[s.workout_id]) scheduleByWorkout[s.workout_id] = [];
    scheduleByWorkout[s.workout_id].push(s.day_of_week);
  }

  const exercisesByWorkout: Record<number, any[]> = {};
  for (const e of exerciseRows) {
    if (!exercisesByWorkout[e.workout_id]) exercisesByWorkout[e.workout_id] = [];
    let estimated_calories = 0;
    let duration_mins = 0;
    if (e.exercise_type === "cardio") {
      estimated_calories = estimateCardioCalories(Number(e.met_value) || 5, Number(e.duration_mins) || 0, weightKg);
      duration_mins = Number(e.duration_mins) || 0;
    } else {
      estimated_calories = estimateStrengthCalories(Number(e.sets), Number(e.reps_min), Number(e.reps_max), Number(e.rest_seconds), weightKg, e.effort_level || "moderate");
      duration_mins = estimateStrengthDuration(Number(e.sets), Number(e.reps_min), Number(e.reps_max), Number(e.rest_seconds));
    }
    exercisesByWorkout[e.workout_id].push({ ...e, estimated_calories, duration_mins_computed: +duration_mins.toFixed(1) });
  }

  return workoutRows.map(w => {
    const exercises = (exercisesByWorkout[w.id] || []).sort((a: any, b: any) => a.order_index - b.order_index);
    const strengthExercises = exercises.filter((e: any) => e.exercise_type !== "cardio");
    const cardioExercises = exercises.filter((e: any) => e.exercise_type === "cardio");
    const strengthDuration = strengthExercises.reduce((sum: number, e: any) => sum + e.duration_mins_computed, 0);
    const strengthCalories = strengthDuration > 0
      ? +(EFFORT_MET.moderate * weightKg * (strengthDuration / 60)).toFixed(1)
      : 0;
    const cardioCalories = cardioExercises.reduce((sum: number, e: any) => sum + e.estimated_calories, 0);
    const total_calories = +(strengthCalories + cardioCalories).toFixed(1);
    return {
      id: w.id,
      workout_name: w.workout_name,
      created_at: w.created_at,
      updated_at: w.updated_at,
      scheduled_days: scheduleByWorkout[w.id] || [],
      exercises,
      total_calories,
    };
  });
}

// ── GET /workouts ──────────────────────────────────────────────────────────────

router.get("/workouts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profileRes = await pool.query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [userId]);
  const weightKg = profileRes.rows[0] ? Number(profileRes.rows[0].weight_kg) : 80;

  const workoutsRes = await pool.query(
    `SELECT * FROM user_workouts WHERE user_id = $1 ORDER BY created_at ASC`, [userId]
  );
  const ids = workoutsRes.rows.map(r => r.id);
  if (ids.length === 0) return res.json([]);

  const exercisesRes = await pool.query(`
    SELECT we.*, e.exercise_name, e.name_arabic, e.muscle_primary, e.exercise_type, e.met_value, e.equipment
    FROM workout_exercises we
    JOIN exercises e ON we.exercise_id = e.id
    WHERE we.workout_id = ANY($1)
    ORDER BY we.workout_id, we.order_index
  `, [ids]);

  const scheduleRes = await pool.query(
    `SELECT * FROM workout_schedule WHERE workout_id = ANY($1)`, [ids]
  );

  res.json(buildWorkouts(workoutsRes.rows, exercisesRes.rows, scheduleRes.rows, weightKg));
});

// ── POST /workouts ─────────────────────────────────────────────────────────────

router.post("/workouts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const countRes = await pool.query(`SELECT COUNT(*) FROM user_workouts WHERE user_id = $1`, [userId]);
  const n = Number(countRes.rows[0].count) + 1;
  const name = `Workout ${n}`;

  const result = await pool.query(
    `INSERT INTO user_workouts (user_id, workout_name) VALUES ($1, $2) RETURNING *`,
    [userId, name]
  );
  res.status(201).json({ ...result.rows[0], scheduled_days: [], exercises: [], total_calories: 0 });
});

// ── PATCH /workouts/:id ────────────────────────────────────────────────────────

router.patch("/workouts/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { workout_name } = req.body;
  if (!workout_name?.trim()) return res.status(400).json({ error: "Name required" });

  const result = await pool.query(
    `UPDATE user_workouts SET workout_name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`,
    [workout_name.trim(), req.params.id, userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
});

// ── DELETE /workouts/:id ───────────────────────────────────────────────────────

router.delete("/workouts/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  await pool.query(`DELETE FROM user_workouts WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
  res.json({ ok: true });
});

// ── POST /workouts/:id/exercises ───────────────────────────────────────────────

router.post("/workouts/:id/exercises", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutCheck = await pool.query(`SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
  if (workoutCheck.rows.length === 0) return res.status(404).json({ error: "Workout not found" });

  const { exercise_id, sets, reps_min, reps_max, weight_kg, rest_seconds, duration_mins, speed_kmh, effort_level, order_index, notes } = req.body;

  const result = await pool.query(`
    INSERT INTO workout_exercises
      (workout_id, exercise_id, sets, reps_min, reps_max, weight_kg, rest_seconds, duration_mins, speed_kmh, effort_level, order_index, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *
  `, [req.params.id, exercise_id, sets ?? 4, reps_min ?? 12, reps_max ?? 15, weight_kg ?? null,
      rest_seconds ?? 60, duration_mins ?? null, speed_kmh ?? null, effort_level ?? null, order_index ?? 1, notes ?? null]);

  const exRes = await pool.query(`SELECT * FROM exercises WHERE id = $1`, [exercise_id]);
  const ex = exRes.rows[0];
  const row = result.rows[0];
  res.status(201).json({ ...row, exercise_name: ex.exercise_name, muscle_primary: ex.muscle_primary, exercise_type: ex.exercise_type, met_value: ex.met_value, equipment: ex.equipment });
});

// ── PATCH /workouts/:id/exercises/:exerciseId ──────────────────────────────────

router.patch("/workouts/:id/exercises/:exerciseId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutCheck = await pool.query(`SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
  if (workoutCheck.rows.length === 0) return res.status(404).json({ error: "Workout not found" });

  const fields = ["sets", "reps_min", "reps_max", "weight_kg", "rest_seconds", "duration_mins", "speed_kmh", "effort_level", "order_index", "notes"];
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${i++}`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
  values.push(req.params.exerciseId, req.params.id);

  const result = await pool.query(
    `UPDATE workout_exercises SET ${updates.join(", ")} WHERE id = $${i} AND workout_id = $${i + 1} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
});

// ── DELETE /workouts/:id/exercises/:exerciseId ─────────────────────────────────

router.delete("/workouts/:id/exercises/:exerciseId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutCheck = await pool.query(`SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
  if (workoutCheck.rows.length === 0) return res.status(404).json({ error: "Workout not found" });

  await pool.query(`DELETE FROM workout_exercises WHERE id = $1 AND workout_id = $2`, [req.params.exerciseId, req.params.id]);
  res.json({ ok: true });
});

// ── POST /workouts/:id/schedule ────────────────────────────────────────────────

router.post("/workouts/:id/schedule", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutCheck = await pool.query(`SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
  if (workoutCheck.rows.length === 0) return res.status(404).json({ error: "Workout not found" });

  const days: string[] = req.body.days ?? [];
  const valid = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const filtered = days.filter(d => valid.includes(d));

  await pool.query(`DELETE FROM workout_schedule WHERE workout_id = $1 AND user_id = $2`, [req.params.id, userId]);
  if (filtered.length > 0) {
    const vals = filtered.map((d, i) => `($${i * 3 + 1},$${i * 3 + 2},$${i * 3 + 3})`).join(",");
    const args = filtered.flatMap(d => [req.params.id, userId, d]);
    await pool.query(`INSERT INTO workout_schedule (workout_id, user_id, day_of_week) VALUES ${vals}`, args);
  }
  res.json({ days: filtered });
});

// ── GET /workouts/day/:day ─────────────────────────────────────────────────────

router.get("/workouts/day/:day", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const profileRes = await pool.query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [userId]);
  const weightKg = profileRes.rows[0] ? Number(profileRes.rows[0].weight_kg) : 80;

  const scheduleRes = await pool.query(`
    SELECT ws.workout_id FROM workout_schedule ws
    JOIN user_workouts uw ON ws.workout_id = uw.id
    WHERE ws.user_id = $1 AND ws.day_of_week = $2
  `, [userId, req.params.day]);

  const ids = scheduleRes.rows.map(r => r.workout_id);
  if (ids.length === 0) return res.json([]);

  const workoutsRes = await pool.query(`SELECT * FROM user_workouts WHERE id = ANY($1)`, [ids]);
  const exercisesRes = await pool.query(`
    SELECT we.*, e.exercise_name, e.name_arabic, e.muscle_primary, e.exercise_type, e.met_value, e.equipment
    FROM workout_exercises we
    JOIN exercises e ON we.exercise_id = e.id
    WHERE we.workout_id = ANY($1)
    ORDER BY we.workout_id, we.order_index
  `, [ids]);
  const allScheduleRes = await pool.query(`SELECT * FROM workout_schedule WHERE workout_id = ANY($1)`, [ids]);

  res.json(buildWorkouts(workoutsRes.rows, exercisesRes.rows, allScheduleRes.rows, weightKg));
});

// ── GET /exercises (library search) ───────────────────────────────────────────

router.get("/exercises", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const q = (req.query.q as string || "").toLowerCase().trim();
  const muscle = (req.query.muscle as string || "").toLowerCase().trim();
  const type = (req.query.type as string || "").toLowerCase().trim();

  let whereClause = `WHERE active = TRUE AND (user_id IS NULL OR user_id = $1)`;
  const params: any[] = [userId];
  let idx = 2;

  if (q) {
    whereClause += ` AND (LOWER(exercise_name) LIKE $${idx} OR LOWER(COALESCE(name_arabic,'')) LIKE $${idx} OR LOWER(muscle_primary) LIKE $${idx})`;
    params.push(`%${q}%`);
    idx++;
  }
  if (muscle && muscle !== "all") {
    if (muscle === "arms") {
      whereClause += ` AND muscle_primary IN ('biceps','triceps')`;
    } else if (muscle === "legs") {
      whereClause += ` AND muscle_primary IN ('quads','hamstrings','calves','glutes')`;
    } else if (muscle === "cardio") {
      whereClause += ` AND exercise_type = 'cardio'`;
    } else {
      whereClause += ` AND muscle_primary = $${idx}`;
      params.push(muscle);
      idx++;
    }
  }
  if (type) {
    whereClause += ` AND exercise_type = $${idx}`;
    params.push(type);
    idx++;
  }

  const result = await pool.query(
    `SELECT * FROM exercises ${whereClause} ORDER BY exercise_type, muscle_primary, exercise_name`,
    params
  );
  res.json(result.rows);
});

// ── POST /exercises - Create custom exercise ────────────────────────────────────

router.post("/exercises", async (req, res) => {
  const userId = requireAuth(req, res);
  if (userId === null) return;

  const {
    exercise_name,
    exercise_type,
    muscle_primary,
    equipment,
    injury_contraindications,
    form_cue,
    light_met,
    moderate_met,
    vigorous_met,
  } = req.body;

  if (!exercise_name || !exercise_type || !muscle_primary || !equipment || !injury_contraindications) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const met_values = exercise_type === "cardio"
    ? JSON.stringify({ light: light_met || 4.0, moderate: moderate_met || 6.0, vigorous: vigorous_met || 8.0 })
    : null;

  const met_value = exercise_type === "cardio" ? (moderate_met || 6.0) : 5.0;

  try {
    const result = await pool.query(
      `INSERT INTO exercises (
        exercise_name, exercise_type, muscle_primary, equipment,
        injury_contraindications, form_cue, met_value, met_values,
        is_custom, user_id, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, TRUE)
      RETURNING id, exercise_name, exercise_type, muscle_primary, equipment, met_value, is_custom`,
      [exercise_name, exercise_type, muscle_primary, equipment, JSON.stringify(injury_contraindications), form_cue, met_value, met_values, userId]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error("Failed to create custom exercise:", e);
    res.status(500).json({ error: "Failed to create custom exercise" });
  }
});

export default router;
