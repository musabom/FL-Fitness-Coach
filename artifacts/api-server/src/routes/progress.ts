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

  res.json({
    weightHistory: weightRes.rows.map(r => ({ date: r.date, weight_kg: Number(r.weight_kg) })),
    mealCompliance,
    workoutCompliance,
  });
});

export default router;
