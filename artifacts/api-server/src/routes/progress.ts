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

// ── Calorie estimation helpers (same as in workouts.ts) ─────────────────────
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

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// GET /progress
router.get("/progress", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const today = todayStr();
  const days = 30;

  // ── 1. Weight History ─────────────────────────────────────────────────────
  const weightRes = await pool.query(
    `SELECT recorded_at::date::text AS date, weight_kg
     FROM weight_history
     WHERE user_id = $1
     ORDER BY recorded_at ASC`,
    [userId]
  );

  // ── 2. Compliance data: build date range ───────────────────────────────────
  const dateRange: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateRange.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const startDate = dateRange[0];

  // ── 3. Meal compliance ────────────────────────────────────────────────────

  // Get the user's recurring meal schedule (meal_id per day_of_week)
  const mealScheduleRes = await pool.query(
    `SELECT meal_id, day_of_week FROM meal_schedule WHERE user_id = $1`,
    [userId]
  );
  // Build map: day_of_week → Set<meal_id>
  const mealScheduleMap: Record<string, Set<number>> = {};
  for (const row of mealScheduleRes.rows) {
    if (!mealScheduleMap[row.day_of_week]) mealScheduleMap[row.day_of_week] = new Set();
    mealScheduleMap[row.day_of_week].add(Number(row.meal_id));
  }

  // Manual meal plan entries for the date range
  const mealEntriesRes = await pool.query(
    `SELECT date::text AS date, meal_id FROM meal_plan_entries
     WHERE user_id = $1 AND date >= $2`,
    [userId, startDate]
  );
  const mealEntriesMap: Record<string, Set<number>> = {};
  for (const row of mealEntriesRes.rows) {
    if (!mealEntriesMap[row.date]) mealEntriesMap[row.date] = new Set();
    mealEntriesMap[row.date].add(Number(row.meal_id));
  }

  // Exclusions
  const mealExclusionsRes = await pool.query(
    `SELECT date::text AS date, meal_id FROM meal_plan_exclusions
     WHERE user_id = $1 AND date >= $2`,
    [userId, startDate]
  );
  const mealExclusionsMap: Record<string, Set<number>> = {};
  for (const row of mealExclusionsRes.rows) {
    if (!mealExclusionsMap[row.date]) mealExclusionsMap[row.date] = new Set();
    mealExclusionsMap[row.date].add(Number(row.meal_id));
  }

  // Meal-level completions
  const mealCompletionsRes = await pool.query(
    `SELECT date::text AS date, meal_id FROM meal_plan_completions
     WHERE user_id = $1 AND date >= $2`,
    [userId, startDate]
  );
  const mealCompletionsMap: Record<string, Set<number>> = {};
  for (const row of mealCompletionsRes.rows) {
    if (!mealCompletionsMap[row.date]) mealCompletionsMap[row.date] = new Set();
    mealCompletionsMap[row.date].add(Number(row.meal_id));
  }

  // Portion-level completions: if all portions of a meal are done, meal is complete
  const portionCompletionsRes = await pool.query(
    `SELECT mpc.date::text AS date, mpc.meal_id,
            COUNT(DISTINCT mpc.portion_id) AS completed_portions,
            (SELECT COUNT(*) FROM meal_portions mp WHERE mp.meal_id = mpc.meal_id) AS total_portions
     FROM meal_portion_completions mpc
     WHERE mpc.user_id = $1 AND mpc.date >= $2
     GROUP BY mpc.date, mpc.meal_id`,
    [userId, startDate]
  );
  const portionCompletedMeals: Record<string, Set<number>> = {};
  for (const row of portionCompletionsRes.rows) {
    if (Number(row.total_portions) > 0 && Number(row.completed_portions) >= Number(row.total_portions)) {
      if (!portionCompletedMeals[row.date]) portionCompletedMeals[row.date] = new Set();
      portionCompletedMeals[row.date].add(Number(row.meal_id));
    }
  }

  // ── 4. Workout compliance ─────────────────────────────────────────────────

  // Recurring workout schedule
  const workoutScheduleRes = await pool.query(
    `SELECT ws.workout_id, ws.day_of_week,
            (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = ws.workout_id) AS exercise_count
     FROM workout_schedule ws
     WHERE ws.user_id = $1`,
    [userId]
  );
  const workoutScheduleMap: Record<string, Array<{ workoutId: number; exerciseCount: number }>> = {};
  for (const row of workoutScheduleRes.rows) {
    if (!workoutScheduleMap[row.day_of_week]) workoutScheduleMap[row.day_of_week] = [];
    workoutScheduleMap[row.day_of_week].push({ workoutId: Number(row.workout_id), exerciseCount: Number(row.exercise_count) });
  }

  // Manual workout entries for date range
  const workoutEntriesRes = await pool.query(
    `SELECT wpe.date::text AS date, wpe.workout_id,
            (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = wpe.workout_id) AS exercise_count
     FROM workout_plan_entries wpe
     WHERE wpe.user_id = $1 AND wpe.date >= $2`,
    [userId, startDate]
  );
  const workoutEntriesMap: Record<string, Array<{ workoutId: number; exerciseCount: number }>> = {};
  for (const row of workoutEntriesRes.rows) {
    if (!workoutEntriesMap[row.date]) workoutEntriesMap[row.date] = [];
    workoutEntriesMap[row.date].push({ workoutId: Number(row.workout_id), exerciseCount: Number(row.exercise_count) });
  }

  // Workout exclusions
  const workoutExclusionsRes = await pool.query(
    `SELECT date::text AS date, workout_id FROM workout_plan_exclusions
     WHERE user_id = $1 AND date >= $2`,
    [userId, startDate]
  );
  const workoutExclusionsMap: Record<string, Set<number>> = {};
  for (const row of workoutExclusionsRes.rows) {
    if (!workoutExclusionsMap[row.date]) workoutExclusionsMap[row.date] = new Set();
    workoutExclusionsMap[row.date].add(Number(row.workout_id));
  }

  // Completed exercises
  const exerciseCompletionsRes = await pool.query(
    `SELECT date::text AS date, COUNT(*) AS completed_exercises
     FROM workout_exercise_completions
     WHERE user_id = $1 AND date >= $2
     GROUP BY date`,
    [userId, startDate]
  );
  const exerciseCompletionsMap: Record<string, number> = {};
  for (const row of exerciseCompletionsRes.rows) {
    exerciseCompletionsMap[row.date] = Number(row.completed_exercises);
  }

  // ── 5. Build daily compliance arrays ─────────────────────────────────────

  const mealCompliance = dateRange.map((date) => {
    const dayOfWeek = DAY_NAMES[new Date(date + "T00:00:00").getDay()];
    const exclusions = mealExclusionsMap[date] ?? new Set<number>();

    // Scheduled meals for this day-of-week (not excluded)
    const scheduledMealIds = new Set<number>(
      [...(mealScheduleMap[dayOfWeek] ?? new Set())].filter(id => !exclusions.has(id))
    );

    // Manual entries that aren't already in the schedule
    const manualEntries = mealEntriesMap[date] ?? new Set<number>();

    // Union: all planned meals
    const plannedMeals = new Set<number>([...scheduledMealIds, ...manualEntries]);
    const planned = plannedMeals.size;

    // Completed: meal-level completions OR all-portions done
    const completedByMeal = mealCompletionsMap[date] ?? new Set<number>();
    const completedByPortions = portionCompletedMeals[date] ?? new Set<number>();
    const completedMeals = new Set<number>([...completedByMeal, ...completedByPortions]);
    // Only count meals that were actually in the planned set
    const completed = [...completedMeals].filter(id => plannedMeals.has(id)).length;

    return { date, planned, completed };
  });

  const workoutCompliance = dateRange.map((date) => {
    const dayOfWeek = DAY_NAMES[new Date(date + "T00:00:00").getDay()];
    const exclusions = workoutExclusionsMap[date] ?? new Set<number>();
    const manualEntries = workoutEntriesMap[date] ?? [];

    // Scheduled workouts not excluded and not already in manual entries
    const manualWorkoutIds = new Set(manualEntries.map(e => e.workoutId));
    const scheduledEntries = (workoutScheduleMap[dayOfWeek] ?? []).filter(
      e => !exclusions.has(e.workoutId) && !manualWorkoutIds.has(e.workoutId)
    );

    const allEntries = [...scheduledEntries, ...manualEntries.filter(e => !exclusions.has(e.workoutId))];
    const planned = allEntries.reduce((sum, e) => sum + e.exerciseCount, 0);
    const completed = exerciseCompletionsMap[date] ?? 0;

    return { date, planned, completed };
  });

  // ── 6. Daily Deficit data ──────────────────────────────────────────────────
  
  // Get current plan info
  const planRes = await pool.query(
    `SELECT tdee_estimated, calorie_target FROM plans WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
    [userId]
  );
  const plan = planRes.rows[0];
  const tdee = plan ? Number(plan.tdee_estimated) : 2000;
  const calorieTarget = plan ? Number(plan.calorie_target) : 1800;
  const plannedDeficit = tdee - calorieTarget;

  // Get daily consumed calories from meal_portion_completions
  const consumedCaloriesRes = await pool.query(
    `SELECT mpc.date::text AS date, SUM(mp.calories) AS total_calories
     FROM meal_portion_completions mpc
     JOIN meal_portions mp ON mpc.portion_id = mp.id
     WHERE mpc.user_id = $1 AND mpc.date >= $2
     GROUP BY mpc.date`,
    [userId, startDate]
  );
  const consumedMap: Record<string, number> = {};
  for (const row of consumedCaloriesRes.rows) {
    consumedMap[row.date] = Number(row.total_calories);
  }

  // Get daily training burn from workout_exercise_completions
  // First fetch user's weight for calorie estimation
  const profileRes = await pool.query(
    `SELECT weight_kg FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const userWeightKg = profileRes.rows[0]?.weight_kg ?? 70;

  const trainingBurnRes = await pool.query(
    `SELECT wec.date::text AS date, we.sets, we.reps_min, we.reps_max, we.rest_seconds, we.duration_mins, we.effort_level, e.exercise_type, e.met_value
     FROM workout_exercise_completions wec
     JOIN workout_exercises we ON wec.workout_exercise_id = we.id
     JOIN exercises e ON we.exercise_id = e.id
     WHERE wec.user_id = $1 AND wec.date >= $2`,
    [userId, startDate]
  );
  
  // Calculate calories for each exercise and sum by date
  const trainingBurnMap: Record<string, number> = {};
  for (const row of trainingBurnRes.rows) {
    let estimated_calories = 0;
    if (row.exercise_type === "cardio") {
      estimated_calories = estimateCardioCalories(Number(row.met_value) || 5, Number(row.duration_mins) || 0, userWeightKg);
    } else {
      estimated_calories = estimateStrengthCalories(Number(row.sets), Number(row.reps_min), Number(row.reps_max), Number(row.rest_seconds), userWeightKg, row.effort_level || "moderate");
    }
    if (!trainingBurnMap[row.date]) trainingBurnMap[row.date] = 0;
    trainingBurnMap[row.date] += estimated_calories;
  }

  // Calculate daily deficit snapshot for each day
  // Daily Deficit = Consumed - Training Burn - TDEE
  // Negative = deficit (under maintenance), Positive = surplus (over maintenance)
  const dailyDeficit = dateRange.map((date) => {
    const consumed = consumedMap[date] ?? 0;
    const trainingBurn = trainingBurnMap[date] ?? 0;
    const dailyDeficitSnapshot = consumed - trainingBurn - tdee;
    
    return { 
      date, 
      maintenance_calories: tdee,
      daily_deficit: dailyDeficitSnapshot
    };
  });

  res.json({
    weightHistory: weightRes.rows.map(r => ({ date: r.date, weight_kg: Number(r.weight_kg) })),
    mealCompliance,
    workoutCompliance,
    dailyDeficit,
  });
});

export default router;
