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

// Intensity multipliers applied on top of the exercise's own MET value.
// Matches the calculation in workouts.ts (Reis et al. 2017, PMC5524349).
const INTENSITY_MULTIPLIER: Record<string, number> = { light: 0.80, moderate: 1.00, heavy: 1.25 };
const FALLBACK_MET = 4.0;

function estimateStrengthCalories(sets: number, repsMin: number, repsMax: number, restSecs: number, weightKg: number, effort = "moderate", exerciseMet?: number) {
  const avgReps = (repsMin + repsMax) / 2;
  const durationMins = (sets * (avgReps * 3 + restSecs)) / 60;
  const baseMet = exerciseMet ?? FALLBACK_MET;
  const met = baseMet * (INTENSITY_MULTIPLIER[effort] ?? 1.0);
  return +(met * weightKg * (durationMins / 60)).toFixed(1);
}

function estimateCardioCalories(metValue: number, durationMins: number, weightKg: number) {
  return +(metValue * weightKg * (durationMins / 60)).toFixed(1);
}

function estimateStrengthDuration(sets: number, repsMin: number, repsMax: number, restSecs: number): number {
  const avgReps = (repsMin + repsMax) / 2;
  return (sets * (avgReps * 3 + restSecs)) / 60;
}

async function getWorkoutSummary(workoutId: number, weightKg: number) {
  const workoutRes = await pool.query(
    `SELECT id, workout_name FROM user_workouts WHERE id = $1`,
    [workoutId]
  );
  if (!workoutRes.rows.length) return null;

  const exercisesRes = await pool.query(
    `SELECT we.*, e.exercise_name, e.muscle_primary, e.exercise_type, e.met_value, e.equipment
     FROM workout_exercises we
     JOIN exercises e ON we.exercise_id = e.id
     WHERE we.workout_id = $1
     ORDER BY we.order_index`,
    [workoutId]
  );

  const exercises = exercisesRes.rows.map(e => {
    let estimated_calories = 0;
    let duration_mins_computed = 0;
    if (e.exercise_type === "cardio") {
      estimated_calories = estimateCardioCalories(Number(e.met_value) || 5, Number(e.duration_mins) || 0, weightKg);
      duration_mins_computed = Number(e.duration_mins) || 0;
    } else {
      const exerciseMet = e.met_value ? Number(e.met_value) : undefined;
      estimated_calories = estimateStrengthCalories(Number(e.sets), Number(e.reps_min), Number(e.reps_max), Number(e.rest_seconds), weightKg, e.effort_level || "moderate", exerciseMet);
      duration_mins_computed = +estimateStrengthDuration(Number(e.sets), Number(e.reps_min), Number(e.reps_max), Number(e.rest_seconds)).toFixed(1);
    }
    return {
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
    };
  });

  // Sum per-exercise calories — each already uses its own MET × intensity multiplier
  const total_calories = +(exercises.reduce((sum, e) => sum + e.estimated_calories, 0)).toFixed(1);

  return {
    id: workoutRes.rows[0].id,
    workout_name: workoutRes.rows[0].workout_name,
    exercises,
    total_calories,
  };
}

// ── Calendar-based rest day helpers ──────────────────────────────────────────
//
// Counts how many days in [startDateStr, endDateStr) (end exclusive) fall on
// one of the given days-of-week (0=Sun … 6=Sat).  O(1) via whole-week math.
function countRestDaysInRange(
  startDateStr: string,
  endDateStr: string,
  restDaysOfWeek: number[]
): number {
  if (restDaysOfWeek.length === 0) return 0;
  const startMs = new Date(startDateStr + "T00:00:00").getTime();
  const endMs   = new Date(endDateStr   + "T00:00:00").getTime();
  const totalDays = Math.floor((endMs - startMs) / 86400000);
  if (totalDays <= 0) return 0;
  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * restDaysOfWeek.length;
  const startDow = new Date(startDateStr + "T00:00:00").getDay();
  for (let i = 0; i < totalDays % 7; i++) {
    if (restDaysOfWeek.includes((startDow + i) % 7)) count++;
  }
  return count;
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

  try {
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];

  const profileRes = await pool.query(
    `SELECT weight_kg, COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const weightKg = profileRes.rows[0] ? Number(profileRes.rows[0].weight_kg) : 80;
  const trainingMode = profileRes.rows[0]?.training_mode ?? 'schedule';

  // Fetch explicitly added workout entries for this date (only in schedule mode)
  const entriesRes = trainingMode !== 'schedule' ? { rows: [] as any[] } : await pool.query(
    `SELECT id AS entry_id, workout_id FROM workout_plan_entries
     WHERE user_id = $1 AND date = $2
     ORDER BY created_at`,
    [userId, dateStr]
  );

  // Fetch workouts scheduled for this day-of-week (only in schedule mode)
  const scheduledRes = trainingMode !== 'schedule' ? { rows: [] as any[] } : await pool.query(
    `SELECT DISTINCT uw.id AS workout_id
     FROM user_workouts uw
     JOIN workout_schedule ws ON ws.workout_id = uw.id
     WHERE uw.user_id = $1 AND ws.day_of_week = $2
       AND NOT EXISTS (
         SELECT 1 FROM workout_plan_entries wpe
         WHERE wpe.user_id = $1 AND wpe.date = $3 AND wpe.workout_id = uw.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM workout_plan_exclusions wpex
         WHERE wpex.user_id = $1 AND wpex.date = $3 AND wpex.workout_id = uw.id
       )
     ORDER BY uw.id`,
    [userId, dayOfWeek, dateStr]
  );

  const allWorkoutRefs = [
    ...entriesRes.rows.map((r: any) => ({ entry_id: r.entry_id, workout_id: r.workout_id, is_entry: true })),
    ...scheduledRes.rows.map((r: any) => ({ entry_id: null, workout_id: r.workout_id, is_entry: false })),
  ];

  // Fetch completion sets
  const allWorkoutIds = allWorkoutRefs.map(r => r.workout_id);
  let completedWorkouts = new Set<number>();
  let completedExercises = new Set<number>();

  if (allWorkoutIds.length > 0) {
    const wpcRes = await pool.query(
      `SELECT workout_id FROM workout_plan_completions WHERE user_id = $1 AND date = $2 AND workout_id = ANY($3)`,
      [userId, dateStr, allWorkoutIds]
    );
    completedWorkouts = new Set(wpcRes.rows.map((r: any) => Number(r.workout_id)));

    const wecRes = await pool.query(
      `SELECT workout_exercise_id FROM workout_exercise_completions WHERE user_id = $1 AND date = $2 AND workout_id = ANY($3)`,
      [userId, dateStr, allWorkoutIds]
    );
    completedExercises = new Set(wecRes.rows.map((r: any) => Number(r.workout_exercise_id)));
  }

  const entries = await Promise.all(
    allWorkoutRefs.map(async (ref) => {
      const workout = await getWorkoutSummary(ref.workout_id, weightKg);
      if (!workout) return null;
      return {
        entry_id: ref.entry_id ?? 0,
        is_entry: ref.is_entry,
        source: "scheduled" as const,
        completed: completedWorkouts.has(ref.workout_id),
        workout: {
          ...workout,
          exercises: workout.exercises.map(e => ({
            ...e,
            completed: completedExercises.has(e.id),
          })),
        },
      };
    })
  );

  // ── Merge cycle program workouts (only in cycle mode) ─────────────────────────
  const cycleProgsRes = trainingMode !== 'cycle' ? { rows: [] as any[] } : await pool.query(
    `SELECT * FROM cycle_programs WHERE user_id = $1 AND is_active = TRUE AND is_default = TRUE ORDER BY created_at`,
    [userId]
  );

  const cycleEntries: Array<NonNullable<(typeof entries)[0]>> = [];
  // Set to true when a calendar_based cycle programme designates today as a rest day
  let isCalendarRestDay = false;

  for (const prog of cycleProgsRes.rows) {
    try {
      // node-postgres returns DATE columns as JS Date objects, so use toISOString()
      const startDateOnly = prog.start_date instanceof Date
        ? prog.start_date.toISOString().slice(0, 10)
        : String(prog.start_date).slice(0, 10);
      const startMs = new Date(startDateOnly + "T00:00:00").getTime();
      const dateMs  = new Date(dateStr       + "T00:00:00").getTime();
      const daysSinceStart = Math.floor((dateMs - startMs) / 86400000);

      // Only show cycle if date is on or after start_date
      if (daysSinceStart < 0) continue;

      const restDayMode: string = prog.rest_day_mode ?? 'in_cycle';
      const restDaysOfWeek: number[] = Array.isArray(prog.rest_days_of_week)
        ? (prog.rest_days_of_week as any[]).map(Number)
        : [];

      // ── calendar_based mode ─────────────────────────────────────────────────
      // Rest days are anchored to specific weekdays; the training sequence
      // advances only on non-rest calendar days.
      if (restDayMode === 'calendar_based') {
        // Is today a designated rest day?
        if (restDaysOfWeek.includes(d.getDay())) {
          isCalendarRestDay = true;
          continue; // nothing to show for this programme today
        }

        // Check for a per-date exclusion override
        const exclusionCheck = await pool.query(
          `SELECT id FROM cycle_program_exclusions WHERE user_id = $1 AND program_id = $2 AND date = $3`,
          [userId, prog.id, dateStr]
        );
        if (exclusionCheck.rows.length > 0) continue;

        // Count rest days that fell between start_date and today (exclusive),
        // then derive how many training days have already happened.
        const restDaysBefore    = countRestDaysInRange(startDateOnly, dateStr, restDaysOfWeek);
        const trainingDaysBefore = daysSinceStart - restDaysBefore;

        // Only consider slots that have a workout (null slots are ignored in this mode)
        const trainingSlotsRes = await pool.query(
          `SELECT * FROM cycle_program_slots WHERE program_id = $1 AND workout_id IS NOT NULL ORDER BY position`,
          [prog.id]
        );
        const trainingSlots = trainingSlotsRes.rows;
        if (trainingSlots.length === 0) continue;

        const slotIndex = ((trainingDaysBefore % trainingSlots.length) + trainingSlots.length) % trainingSlots.length;
        const slot = trainingSlots[slotIndex];

        if (allWorkoutRefs.some(r => r.workout_id === slot.workout_id)) continue;

        const workout = await getWorkoutSummary(slot.workout_id, weightKg);
        if (!workout) continue;

        const cycleWpcRes = await pool.query(
          `SELECT workout_id FROM workout_plan_completions WHERE user_id = $1 AND date = $2 AND workout_id = $3`,
          [userId, dateStr, slot.workout_id]
        );
        const cycleWecRes = await pool.query(
          `SELECT workout_exercise_id FROM workout_exercise_completions WHERE user_id = $1 AND date = $2 AND workout_id = $3`,
          [userId, dateStr, slot.workout_id]
        );
        const cycleCompletedExercises = new Set(cycleWecRes.rows.map((r: any) => Number(r.workout_exercise_id)));

        cycleEntries.push({
          entry_id: 0,
          is_entry: false,
          source: "cycle" as const,
          cycle_program_id: prog.id,
          cycle_program_name: prog.name,
          cycle_position: slotIndex,
          cycle_slot_label: slot.label ?? null,
          completed: cycleWpcRes.rows.length > 0,
          workout: {
            ...workout,
            exercises: workout.exercises.map(e => ({
              ...e,
              completed: cycleCompletedExercises.has(e.id),
            })),
          },
        } as any);

        continue; // done with this programme for calendar_based mode
      }

      // ── in_cycle mode (original behaviour) ─────────────────────────────────
      const cycleLength = Number(prog.cycle_length);
      if (!cycleLength || cycleLength < 1) continue;

      const position = ((daysSinceStart % cycleLength) + cycleLength) % cycleLength;

      // Check for exclusion
      const exclusionCheck = await pool.query(
        `SELECT id FROM cycle_program_exclusions WHERE user_id = $1 AND program_id = $2 AND date = $3`,
        [userId, prog.id, dateStr]
      );
      if (exclusionCheck.rows.length > 0) continue;

      // Get slot for this position
      const slotRes = await pool.query(
        `SELECT * FROM cycle_program_slots WHERE program_id = $1 AND position = $2`,
        [prog.id, position]
      );
      const slot = slotRes.rows[0];

      // No slot or no workout assigned = rest day, skip
      if (!slot || !slot.workout_id) continue;

      // Skip if this workout is already in the scheduled entries
      if (allWorkoutRefs.some(r => r.workout_id === slot.workout_id)) continue;

      const workout = await getWorkoutSummary(slot.workout_id, weightKg);
      if (!workout) continue;

      // Load completions for this cycle workout specifically
      const cycleWpcRes = await pool.query(
        `SELECT workout_id FROM workout_plan_completions WHERE user_id = $1 AND date = $2 AND workout_id = $3`,
        [userId, dateStr, slot.workout_id]
      );
      const cycleWecRes = await pool.query(
        `SELECT workout_exercise_id FROM workout_exercise_completions WHERE user_id = $1 AND date = $2 AND workout_id = $3`,
        [userId, dateStr, slot.workout_id]
      );
      const cycleWorkoutCompleted = cycleWpcRes.rows.length > 0;
      const cycleCompletedExercises = new Set(cycleWecRes.rows.map((r: any) => Number(r.workout_exercise_id)));

      cycleEntries.push({
        entry_id: 0,
        is_entry: false,
        source: "cycle" as const,
        cycle_program_id: prog.id,
        cycle_program_name: prog.name,
        cycle_position: position,
        cycle_slot_label: slot.label ?? null,
        completed: cycleWorkoutCompleted,
        workout: {
          ...workout,
          exercises: workout.exercises.map(e => ({
            ...e,
            completed: cycleCompletedExercises.has(e.id),
          })),
        },
      } as any);
    } catch (err) {
      console.error("Error processing cycle prog", prog.id, err);
    }
  }

  const validEntries = [
    ...(entries.filter(Boolean) as NonNullable<typeof entries[0]>[]),
    ...cycleEntries,
  ];

  const total_calories = validEntries.reduce((sum, e) => sum + (e!.workout.total_calories ?? 0), 0);

  // Calculate burned_calories based on completed exercises (partial completion counts)
  const burned_calories = validEntries.reduce((sum, entry) => {
    const completedCalories = entry!.workout.exercises
      .filter(ex => ex.completed)
      .reduce((exSum, ex) => exSum + ex.estimated_calories, 0);
    return sum + completedCalories;
  }, 0);

  console.log(`workout-plan ${dateStr}: mode=${trainingMode} cycleProgs=${cycleProgsRes.rows.length} cycleEntries=${cycleEntries.length} total=${validEntries.length} isCalendarRest=${isCalendarRestDay}`);
  res.json({
    date: dateStr,
    day_of_week: dayOfWeek,
    entries: validEntries,
    total_calories: +total_calories.toFixed(1),
    burned_calories: +burned_calories.toFixed(1),
    is_calendar_rest_day: isCalendarRestDay,
  });
  } catch (err) {
    console.error("GET /workout-plan error:", err);
    res.status(500).json({ error: "Failed to load workout plan" });
  }
});

// ── POST /workout-plan ── Add a workout to a specific date ────────────────────

router.post("/workout-plan", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { date, workout_id } = req.body as { date?: string; workout_id?: number };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
    return;
  }
  if (!workout_id) {
    res.status(400).json({ error: "workout_id is required" });
    return;
  }

  const ownerCheck = await pool.query(
    "SELECT id FROM user_workouts WHERE id = $1 AND user_id = $2",
    [workout_id, userId]
  );
  if (!ownerCheck.rows.length) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO workout_plan_entries (user_id, date, workout_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date, workout_id) DO NOTHING
     RETURNING id`,
    [userId, date, workout_id]
  );

  if (!result.rows.length) {
    res.status(409).json({ error: "Workout already added to this day" });
    return;
  }

  res.status(201).json({ entry_id: result.rows[0].id, date, workout_id });
});

// ── DELETE /workout-plan/:entryId ── Remove a workout entry or exclude scheduled workout ──

router.delete("/workout-plan/:entryId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const entryId = Number(req.params["entryId"]);
  const workoutId = Number(req.query["workout_id"]);
  const dateStr = req.query["date"] as string;

  // If entryId is 0, it's a scheduled workout that needs exclusion
  if (entryId === 0) {
    if (!workoutId || !dateStr) {
      res.status(400).json({ error: "workout_id and date are required for scheduled workout exclusion" });
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
      `INSERT INTO workout_plan_exclusions (user_id, date, workout_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, date, workout_id) DO NOTHING`,
      [userId, dateStr, workoutId]
    );

    res.json({ message: "Excluded from schedule" });
    return;
  }

  // Otherwise it's a manually-added entry
  const check = await pool.query(
    "SELECT id, date, workout_id FROM workout_plan_entries WHERE id = $1 AND user_id = $2",
    [entryId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const { date, workout_id } = check.rows[0];
  await pool.query("DELETE FROM workout_plan_entries WHERE id = $1", [entryId]);
  await pool.query(
    "DELETE FROM workout_plan_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3",
    [userId, workout_id, date]
  );
  await pool.query(
    "DELETE FROM workout_exercise_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3",
    [userId, workout_id, date]
  );

  res.json({ message: "Removed" });
});

// ── POST /workout-plan/:workoutId/complete ────────────────────────────────────

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

  // If this workout isn't in entries yet, add it so it's tracked
  await pool.query(
    `INSERT INTO workout_plan_entries (user_id, date, workout_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date, workout_id) DO NOTHING`,
    [userId, date, workoutId]
  );

  await pool.query(
    `INSERT INTO workout_plan_completions (user_id, workout_id, date)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, workout_id, date) DO NOTHING`,
    [userId, workoutId, date]
  );

  // Bulk-mark all exercises complete
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
  await pool.query(
    "DELETE FROM workout_exercise_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3",
    [userId, workoutId, date]
  );

  res.json({ workout_id: workoutId, date, completed: false });
});

// ── POST /workout-plan/:workoutId/exercises/:weId/complete ────────────────────

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

  // Auto-complete workout if all exercises done
  const totalRes = await pool.query(`SELECT COUNT(*) AS total FROM workout_exercises WHERE workout_id = $1`, [workoutId]);
  const doneRes = await pool.query(
    `SELECT COUNT(*) AS done FROM workout_exercise_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3`,
    [userId, workoutId, date]
  );
  const workoutAutoCompleted = Number(totalRes.rows[0].total) > 0 && Number(doneRes.rows[0].done) >= Number(totalRes.rows[0].total);

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
  await pool.query(
    "DELETE FROM workout_plan_completions WHERE user_id = $1 AND workout_id = $2 AND date = $3",
    [userId, workoutId, date]
  );

  res.json({ workout_exercise_id: weId, date, completed: false });
});

export default router;
