import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: import("express").Request, res: import("express").Response): number | null {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.userId;
}

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

// ── GET /workout-plan?date=YYYY-MM-DD ─────────────────────────────────────────

router.get("/workout-plan", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const dateStr = (req.query["date"] as string) || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    return;
  }

  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];

  const profileRes = await pool.query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [userId]);
  const weightKg = profileRes.rows[0] ? Number(profileRes.rows[0].weight_kg) : 80;

  const workoutsRes = await pool.query(
    `SELECT DISTINCT uw.id, uw.workout_name, uw.created_at, uw.updated_at
     FROM user_workouts uw
     JOIN workout_schedule ws ON ws.workout_id = uw.id
     WHERE uw.user_id = $1 AND ws.day_of_week = $2
     ORDER BY uw.created_at ASC`,
    [userId, dayOfWeek]
  );

  if (workoutsRes.rows.length === 0) {
    res.json({ date: dateStr, day_of_week: dayOfWeek, workouts: [] });
    return;
  }

  const workoutIds = workoutsRes.rows.map((r: any) => r.id);

  const exercisesRes = await pool.query(
    `SELECT we.*, e.exercise_name, e.muscle_primary, e.exercise_type, e.met_value, e.equipment
     FROM workout_exercises we
     JOIN exercises e ON we.exercise_id = e.id
     WHERE we.workout_id = ANY($1)
     ORDER BY we.workout_id, we.order_index`,
    [workoutIds]
  );

  const workoutCompletionsRes = await pool.query(
    `SELECT workout_id FROM workout_plan_completions
     WHERE user_id = $1 AND date = $2 AND workout_id = ANY($3)`,
    [userId, dateStr, workoutIds]
  );
  const completedWorkouts = new Set<number>(workoutCompletionsRes.rows.map((r: any) => Number(r.workout_id)));

  const exerciseCompletionsRes = await pool.query(
    `SELECT workout_exercise_id FROM workout_exercise_completions
     WHERE user_id = $1 AND date = $2 AND workout_id = ANY($3)`,
    [userId, dateStr, workoutIds]
  );
  const completedExercises = new Set<number>(exerciseCompletionsRes.rows.map((r: any) => Number(r.workout_exercise_id)));

  const exercisesByWorkout: Record<number, any[]> = {};
  for (const e of exercisesRes.rows) {
    if (!exercisesByWorkout[e.workout_id]) exercisesByWorkout[e.workout_id] = [];
    let estimated_calories = 0;
    let duration_mins_computed = 0;
    if (e.exercise_type === "cardio") {
      estimated_calories = estimateCardioCalories(Number(e.met_value) || 5, Number(e.duration_mins) || 0, weightKg);
      duration_mins_computed = Number(e.duration_mins) || 0;
    } else {
      estimated_calories = estimateStrengthCalories(Number(e.sets), Number(e.reps_min), Number(e.reps_max), Number(e.rest_seconds), weightKg, e.effort_level || "moderate");
      duration_mins_computed = +estimateStrengthDuration(Number(e.sets), Number(e.reps_min), Number(e.reps_max), Number(e.rest_seconds)).toFixed(1);
    }
    exercisesByWorkout[e.workout_id].push({
      id: e.id,
      workout_id: e.workout_id,
      exercise_id: e.exercise_id,
      exercise_name: e.exercise_name,
      muscle_primary: e.muscle_primary,
      exercise_type: e.exercise_type,
      equipment: e.equipment,
      sets: Number(e.sets),
      reps_min: Number(e.reps_min),
      reps_max: Number(e.reps_max),
      weight_kg: e.weight_kg ? Number(e.weight_kg) : null,
      rest_seconds: Number(e.rest_seconds),
      duration_mins: e.duration_mins ? Number(e.duration_mins) : null,
      effort_level: e.effort_level ?? null,
      order_index: Number(e.order_index),
      notes: e.notes ?? null,
      estimated_calories,
      duration_mins_computed,
      completed: completedExercises.has(Number(e.id)),
    });
  }

  const workouts = workoutsRes.rows.map((w: any) => {
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
      exercises,
      total_calories,
      completed: completedWorkouts.has(Number(w.id)),
    };
  });

  res.json({ date: dateStr, day_of_week: dayOfWeek, workouts });
});

// ── POST /workout-plan/:workoutId/complete ────────────────────────────────────
// Marks a workout done AND bulk-inserts all its exercise completions.

router.post("/workout-plan/:workoutId/complete", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutId = Number(req.params["workoutId"]);
  const { date } = req.body as { date?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
    return;
  }

  const check = await pool.query(
    "SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2",
    [workoutId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  await pool.query(
    `INSERT INTO workout_plan_completions (user_id, workout_id, date)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, workout_id, date) DO NOTHING`,
    [userId, workoutId, date]
  );

  // Bulk-mark all exercises in this workout as complete
  const weRes = await pool.query(
    `SELECT id FROM workout_exercises WHERE workout_id = $1`,
    [workoutId]
  );
  for (const we of weRes.rows) {
    await pool.query(
      `INSERT INTO workout_exercise_completions (user_id, workout_id, workout_exercise_id, date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, workout_id, workout_exercise_id, date) DO NOTHING`,
      [userId, workoutId, we.id, date]
    );
  }

  res.json({ workout_id: workoutId, date, completed: true });
});

// ── DELETE /workout-plan/:workoutId/complete ──────────────────────────────────
// Unmarks a workout AND removes all its exercise completions.

router.delete("/workout-plan/:workoutId/complete", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutId = Number(req.params["workoutId"]);
  const date = req.query["date"] as string | undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date query param (YYYY-MM-DD) is required" });
    return;
  }

  await pool.query(
    "DELETE FROM workout_plan_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3",
    [userId, workoutId, date]
  );

  // Also clear all exercise completions for this workout/date
  await pool.query(
    "DELETE FROM workout_exercise_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3",
    [userId, workoutId, date]
  );

  res.json({ workout_id: workoutId, date, completed: false });
});

// ── POST /workout-plan/:workoutId/exercises/:weId/complete ────────────────────
// Marks one exercise done. If all exercises are now done, auto-completes workout.

router.post("/workout-plan/:workoutId/exercises/:weId/complete", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutId = Number(req.params["workoutId"]);
  const weId = Number(req.params["weId"]);
  const { date } = req.body as { date?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
    return;
  }

  // Ownership: exercise must belong to workout which belongs to user
  const check = await pool.query(
    `SELECT we.id FROM workout_exercises we
     JOIN user_workouts uw ON uw.id = we.workout_id
     WHERE we.id = $1 AND we.workout_id = $2 AND uw.user_id = $3`,
    [weId, workoutId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Exercise not found in workout" });
    return;
  }

  await pool.query(
    `INSERT INTO workout_exercise_completions (user_id, workout_id, workout_exercise_id, date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, workout_id, workout_exercise_id, date) DO NOTHING`,
    [userId, workoutId, weId, date]
  );

  // Check if all exercises in this workout are now complete
  const totalRes = await pool.query(
    `SELECT COUNT(*) AS total FROM workout_exercises WHERE workout_id = $1`,
    [workoutId]
  );
  const completedRes = await pool.query(
    `SELECT COUNT(*) AS done FROM workout_exercise_completions
     WHERE user_id = $1 AND workout_id = $2 AND date = $3`,
    [userId, workoutId, date]
  );
  const total = Number(totalRes.rows[0].total);
  const done = Number(completedRes.rows[0].done);
  const workoutAutoCompleted = total > 0 && done >= total;

  if (workoutAutoCompleted) {
    await pool.query(
      `INSERT INTO workout_plan_completions (user_id, workout_id, date)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, workout_id, date) DO NOTHING`,
      [userId, workoutId, date]
    );
  }

  res.json({ workout_exercise_id: weId, date, completed: true, workout_completed: workoutAutoCompleted });
});

// ── DELETE /workout-plan/:workoutId/exercises/:weId/complete ──────────────────
// Unmarks one exercise. Also removes workout-level completion if set.

router.delete("/workout-plan/:workoutId/exercises/:weId/complete", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const workoutId = Number(req.params["workoutId"]);
  const weId = Number(req.params["weId"]);
  const date = req.query["date"] as string | undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date query param (YYYY-MM-DD) is required" });
    return;
  }

  await pool.query(
    "DELETE FROM workout_exercise_completions WHERE user_id = $1 AND workout_id = $2 AND workout_exercise_id = $3 AND date = $4",
    [userId, workoutId, weId, date]
  );

  // Un-complete the workout if it was marked complete
  await pool.query(
    "DELETE FROM workout_plan_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3",
    [userId, workoutId, date]
  );

  res.json({ workout_exercise_id: weId, date, completed: false });
});

export default router;
