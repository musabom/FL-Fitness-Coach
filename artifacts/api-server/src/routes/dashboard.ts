import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { calcExerciseRowCalories } from "../lib/workout-calories";
import { resolveCalendarSlotIndexForDate } from "../lib/cycle-dates";

const router: IRouter = Router();

function requireAuth(req: import("express").Request, res: import("express").Response): number | null {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return (res.locals["userId"] as number | undefined) ?? req.session.userId;
}

// Calorie math lives in lib/workout-calories.ts — the same formula the
// workout-plan endpoints use, so dashboard numbers always match the plan.
const calcExerciseCalories = calcExerciseRowCalories;

async function getNutritionData(userId: number, date: string) {
  try {
    // Consumed: sum of completed portions
    const consumedRes = await pool.query(
      `SELECT
         COALESCE(SUM(
           CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
             THEN COALESCE(f.calories, uf.calories) * mp.quantity_g
             ELSE COALESCE(f.calories, uf.calories) * mp.quantity_g / 100 END
         ), 0) AS calories,
         COALESCE(SUM(
           CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
             THEN COALESCE(f.protein_g, uf.protein_g) * mp.quantity_g
             ELSE COALESCE(f.protein_g, uf.protein_g) * mp.quantity_g / 100 END
         ), 0) AS protein_g,
         COALESCE(SUM(
           CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
             THEN COALESCE(f.carbs_g, uf.carbs_g) * mp.quantity_g
             ELSE COALESCE(f.carbs_g, uf.carbs_g) * mp.quantity_g / 100 END
         ), 0) AS carbs_g,
         COALESCE(SUM(
           CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
             THEN COALESCE(f.fat_g, uf.fat_g) * mp.quantity_g
             ELSE COALESCE(f.fat_g, uf.fat_g) * mp.quantity_g / 100 END
         ), 0) AS fat_g
       FROM meal_portion_completions mpc
       JOIN meal_portions mp ON mp.id = mpc.portion_id
       LEFT JOIN foods f ON f.id = mp.food_id AND mp.food_source = 'database'
       LEFT JOIN user_foods uf ON uf.id = mp.food_id AND mp.food_source = 'user'
       WHERE mpc.user_id = $1 AND mpc.date = $2`,
      [userId, date]
    );
    const consumedRow = consumedRes.rows[0];
    const consumed = {
      calories: +Number(consumedRow.calories).toFixed(1),
      protein_g: +Number(consumedRow.protein_g).toFixed(2),
      carbs_g: +Number(consumedRow.carbs_g).toFixed(2),
      fat_g: +Number(consumedRow.fat_g).toFixed(2),
    };

    // Planned: user's active nutrition plan targets
    const planRes = await pool.query(
      `SELECT calorie_target, protein_g, carbs_g, fat_g
       FROM plans
       WHERE user_id = $1 AND active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    const planRow = planRes.rows[0];
    const planned = {
      calories: planRow ? +Number(planRow.calorie_target).toFixed(1) : 0,
      protein_g: planRow ? +Number(planRow.protein_g).toFixed(2) : 0,
      carbs_g: planRow ? +Number(planRow.carbs_g).toFixed(2) : 0,
      fat_g: planRow ? +Number(planRow.fat_g).toFixed(2) : 0,
    };

    return { consumed, planned };
  } catch (error) {
    // Phase 2 feature not yet implemented: meal tracking tables don't exist
    // Return zero nutrition data as placeholder
    return {
      consumed: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      planned: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    };
  }
}

async function getWorkoutCalories(userId: number, date: string, weightKg: number) {
  try {
    const d = new Date(date + "T00:00:00");
    const dayOfWeek = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][d.getDay()];

    const modeRes = await pool.query(
      `SELECT COALESCE(training_mode, 'schedule') as training_mode FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const trainingMode = modeRes.rows[0]?.training_mode ?? 'schedule';

    let plannedRows: any[] = [];

    if (trainingMode === 'schedule') {
      // Schedule mode: scheduled workouts (not excluded) + manually added entries
      const plannedRes = await pool.query(
        `SELECT we.sets, we.reps_min, we.reps_max, we.rest_seconds, we.duration_mins, we.effort_level,
                e.exercise_type, e.met_value
         FROM user_workouts uw
         JOIN workout_schedule ws ON ws.workout_id = uw.id
         JOIN workout_exercises we ON we.workout_id = uw.id
         JOIN exercises e ON e.id = we.exercise_id
         WHERE uw.user_id = $1 AND ws.day_of_week = $2
           AND NOT EXISTS (SELECT 1 FROM workout_plan_exclusions WHERE user_id = $1 AND date = $3 AND workout_id = uw.id)
           AND NOT EXISTS (SELECT 1 FROM workout_plan_entries WHERE user_id = $1 AND date = $3 AND workout_id = uw.id)
         UNION ALL
         SELECT we.sets, we.reps_min, we.reps_max, we.rest_seconds, we.duration_mins, we.effort_level,
                e.exercise_type, e.met_value
         FROM workout_plan_entries wpe
         JOIN workout_exercises we ON we.workout_id = wpe.workout_id
         JOIN exercises e ON e.id = we.exercise_id
         WHERE wpe.user_id = $1 AND wpe.date = $3`,
        [userId, dayOfWeek, date]
      );
      plannedRows = plannedRes.rows;
    } else {
      // Cycle mode: resolve today's cycle workout with the SAME logic as
      // /workout-plan (calendar_based rest-day skipping; legacy in_cycle kept).
      const progRes = await pool.query(
        `SELECT id, start_date, cycle_length, rest_day_mode, rest_days_of_week
         FROM cycle_programs WHERE user_id = $1 AND is_default = TRUE AND is_active = TRUE LIMIT 1`,
        [userId]
      );
      if (progRes.rows.length > 0) {
        const prog = progRes.rows[0];
        const startDateOnly = prog.start_date instanceof Date
          ? prog.start_date.toISOString().slice(0, 10)
          : String(prog.start_date).slice(0, 10);

        // Per-date exclusion → no planned cycle workout that day
        const exclusionRes = await pool.query(
          `SELECT id FROM cycle_program_exclusions WHERE user_id = $1 AND program_id = $2 AND date = $3`,
          [userId, prog.id, date]
        );

        let workoutId: number | null = null;
        if (exclusionRes.rows.length === 0) {
          const restDayMode: string = prog.rest_day_mode ?? "in_cycle";
          if (restDayMode === "calendar_based") {
            const restDows: number[] = Array.isArray(prog.rest_days_of_week)
              ? (prog.rest_days_of_week as any[]).map(Number)
              : [];
            const slotsRes = await pool.query(
              `SELECT workout_id FROM cycle_program_slots
               WHERE program_id = $1 AND workout_id IS NOT NULL ORDER BY position`,
              [prog.id]
            );
            const idx = resolveCalendarSlotIndexForDate(startDateOnly, date, restDows, slotsRes.rows.length);
            if (idx !== null && slotsRes.rows[idx]) workoutId = Number(slotsRes.rows[idx].workout_id);
          } else {
            const startMs = new Date(startDateOnly + "T00:00:00").getTime();
            const dateMs = new Date(date + "T00:00:00").getTime();
            const daysSince = Math.floor((dateMs - startMs) / 86400000);
            const cycleLength = Number(prog.cycle_length);
            if (daysSince >= 0 && cycleLength >= 1) {
              const position = ((daysSince % cycleLength) + cycleLength) % cycleLength;
              const slotRes = await pool.query(
                `SELECT workout_id FROM cycle_program_slots WHERE program_id = $1 AND position = $2`,
                [prog.id, position]
              );
              if (slotRes.rows[0]?.workout_id) workoutId = Number(slotRes.rows[0].workout_id);
            }
          }
        }

        if (workoutId !== null) {
          const exercisesRes = await pool.query(
            `SELECT we.sets, we.reps_min, we.reps_max, we.rest_seconds, we.duration_mins, we.effort_level,
                    e.exercise_type, e.met_value
             FROM workout_exercises we
             JOIN exercises e ON e.id = we.exercise_id
             WHERE we.workout_id = $1`,
            [workoutId]
          );
          plannedRows = exercisesRes.rows;
        }
      }
    }

    const planned_calories = +plannedRows.reduce((sum: number, row: any) => sum + calcExerciseCalories(row, weightKg), 0).toFixed(1);

    // Burned: completed exercises for this date
    const burnedRes = await pool.query(
      `SELECT we.sets, we.reps_min, we.reps_max, we.rest_seconds, we.duration_mins, we.effort_level,
              e.exercise_type, e.met_value
       FROM workout_exercise_completions wec
       JOIN workout_exercises we ON we.id = wec.workout_exercise_id
       JOIN exercises e ON e.id = we.exercise_id
       WHERE wec.user_id = $1 AND wec.date = $2`,
      [userId, date]
    );

    const burned_calories = +burnedRes.rows.reduce((sum: number, row: any) => sum + calcExerciseCalories(row, weightKg), 0).toFixed(1);

    return { planned_calories, burned_calories };
  } catch (error) {
    // Phase 2 feature not yet implemented: workout tracking tables don't exist
    // Return zero workout calories as placeholder
    return { planned_calories: 0, burned_calories: 0 };
  }
}

// The user's OWN plan for the date: total macros of the meals they scheduled
// (weekday schedule minus exclusions, plus manual entries) — the same set the
// /meal-plan endpoint shows. This is "my plan", distinct from the computed
// baseline target in the plans table.
async function getPlannedIntakeForDate(userId: number, date: string) {
  try {
    const d = new Date(date + "T00:00:00");
    const dayOfWeek = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][d.getDay()];
    const result = await pool.query(
      `WITH day_meals AS (
         SELECT meal_id FROM meal_plan_entries WHERE user_id = $1 AND date = $2
         UNION
         SELECT ms.meal_id FROM meal_schedule ms
         WHERE ms.user_id = $1 AND ms.day_of_week = $3
           AND NOT EXISTS (SELECT 1 FROM meal_plan_entries e  WHERE e.user_id = $1 AND e.date = $2 AND e.meal_id = ms.meal_id)
           AND NOT EXISTS (SELECT 1 FROM meal_plan_exclusions x WHERE x.user_id = $1 AND x.date = $2 AND x.meal_id = ms.meal_id)
       )
       SELECT
         COALESCE(SUM(CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
           THEN COALESCE(f.calories, uf.calories) * mp.quantity_g
           ELSE COALESCE(f.calories, uf.calories) * mp.quantity_g / 100 END), 0) AS calories,
         COALESCE(SUM(CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
           THEN COALESCE(f.protein_g, uf.protein_g) * mp.quantity_g
           ELSE COALESCE(f.protein_g, uf.protein_g) * mp.quantity_g / 100 END), 0) AS protein_g,
         COALESCE(SUM(CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
           THEN COALESCE(f.carbs_g, uf.carbs_g) * mp.quantity_g
           ELSE COALESCE(f.carbs_g, uf.carbs_g) * mp.quantity_g / 100 END), 0) AS carbs_g,
         COALESCE(SUM(CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
           THEN COALESCE(f.fat_g, uf.fat_g) * mp.quantity_g
           ELSE COALESCE(f.fat_g, uf.fat_g) * mp.quantity_g / 100 END), 0) AS fat_g
       FROM day_meals dm
       JOIN meal_portions mp ON mp.meal_id = dm.meal_id
       LEFT JOIN foods f ON f.id = mp.food_id AND mp.food_source = 'database'
       LEFT JOIN user_foods uf ON uf.id = mp.food_id AND mp.food_source = 'user'`,
      [userId, date, dayOfWeek]
    );
    const row = result.rows[0];
    return {
      calories: +Number(row.calories).toFixed(1),
      protein_g: +Number(row.protein_g).toFixed(2),
      carbs_g: +Number(row.carbs_g).toFixed(2),
      fat_g: +Number(row.fat_g).toFixed(2),
    };
  } catch {
    return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
}

// GET /dashboard/today?date=YYYY-MM-DD
router.get("/dashboard/today", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const dateStr = (req.query["date"] as string) || (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
  })();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }

  const profileRes = await pool.query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [userId]);
  const weightKg = profileRes.rows[0] ? Number(profileRes.rows[0].weight_kg) : 80;

  // Fetch plan (calorie target and TDEE)
  const planRes = await pool.query(
    `SELECT calorie_target, tdee_estimated FROM plans WHERE user_id = $1 AND active = true ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const calorieTarget = planRes.rows[0] ? Number(planRes.rows[0].calorie_target) : 0;
  const tdeeEstimated = planRes.rows[0] ? Number(planRes.rows[0].tdee_estimated) : 0;

  const [nutrition, training, plannedIntake] = await Promise.all([
    getNutritionData(userId, dateStr),
    getWorkoutCalories(userId, dateStr, weightKg),
    getPlannedIntakeForDate(userId, dateStr),
  ]);

  // Calculate balance: consumed - (metabolic rate + exercise burn)
  const totalBurned = tdeeEstimated + training.burned_calories;
  const balance = nutrition.consumed.calories - totalBurned;

  res.json({
    date: dateStr, nutrition, training, calorieTarget, tdeeEstimated,
    workoutBurned: training.burned_calories, totalBurned, balance,
    // "My plan" (user input) — distinct from the computed baseline target
    today_plan: { intake: plannedIntake, planned_burn: training.planned_calories },
  });
});

// GET /dashboard/weekly?week_start=YYYY-MM-DD  (defaults to current Mon)
router.get("/dashboard/weekly", async (req, res): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    // Determine week start (Monday)
    let weekStart: string;
    if (req.query["week_start"]) {
      weekStart = req.query["week_start"] as string;
    } else {
      const now = new Date();
      const day = now.getDay(); // 0=Sun
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      weekStart = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
    }

    const startDate = new Date(weekStart + "T00:00:00");
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
    }
    const weekEnd = dates[6];

    const profileRes = await pool.query(`SELECT weight_kg FROM user_profiles WHERE user_id = $1`, [userId]);
    const weightKg = profileRes.rows[0] ? Number(profileRes.rows[0].weight_kg) : 80;

    // Initialize with empty data (Phase 2 features not yet implemented)
    let nutByDate = new Map<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }>();
    let burnedByDate = new Map<string, number>();

    try {
      // Nutrition consumed per day in range
      const nutRes = await pool.query(
        `SELECT mpc.date::text AS date,
           COALESCE(SUM(
             CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
               THEN COALESCE(f.calories, uf.calories) * mp.quantity_g
               ELSE COALESCE(f.calories, uf.calories) * mp.quantity_g / 100 END
           ), 0) AS calories,
           COALESCE(SUM(
             CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
               THEN COALESCE(f.protein_g, uf.protein_g) * mp.quantity_g
               ELSE COALESCE(f.protein_g, uf.protein_g) * mp.quantity_g / 100 END
           ), 0) AS protein_g,
           COALESCE(SUM(
             CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
               THEN COALESCE(f.carbs_g, uf.carbs_g) * mp.quantity_g
               ELSE COALESCE(f.carbs_g, uf.carbs_g) * mp.quantity_g / 100 END
           ), 0) AS carbs_g,
           COALESCE(SUM(
             CASE WHEN COALESCE(f.serving_unit, uf.serving_unit) = 'per_piece'
               THEN COALESCE(f.fat_g, uf.fat_g) * mp.quantity_g
               ELSE COALESCE(f.fat_g, uf.fat_g) * mp.quantity_g / 100 END
           ), 0) AS fat_g
         FROM meal_portion_completions mpc
         JOIN meal_portions mp ON mp.id = mpc.portion_id
         LEFT JOIN foods f ON f.id = mp.food_id AND mp.food_source = 'database'
         LEFT JOIN user_foods uf ON uf.id = mp.food_id AND mp.food_source = 'user'
         WHERE mpc.user_id = $1 AND mpc.date >= $2 AND mpc.date <= $3
         GROUP BY mpc.date`,
        [userId, weekStart, weekEnd]
      );

      // Burned calories per day (raw exercise rows, we compute in JS)
      const burnedRes = await pool.query(
        `SELECT wec.date::text AS date, we.sets, we.reps_min, we.reps_max, we.rest_seconds,
                we.duration_mins, we.effort_level, e.exercise_type, e.met_value
         FROM workout_exercise_completions wec
         JOIN workout_exercises we ON we.id = wec.workout_exercise_id
         JOIN exercises e ON e.id = we.exercise_id
         WHERE wec.user_id = $1 AND wec.date >= $2 AND wec.date <= $3`,
        [userId, weekStart, weekEnd]
      );

      // Build per-day maps
      for (const row of nutRes.rows) {
        nutByDate.set(row.date, {
          calories: +Number(row.calories).toFixed(1),
          protein_g: +Number(row.protein_g).toFixed(2),
          carbs_g: +Number(row.carbs_g).toFixed(2),
          fat_g: +Number(row.fat_g).toFixed(2),
        });
      }

      for (const row of burnedRes.rows) {
        const prev = burnedByDate.get(row.date) ?? 0;
        burnedByDate.set(row.date, prev + calcExerciseCalories(row, weightKg));
      }
    } catch (error) {
      // Phase 2 features not yet implemented: meal/workout tracking tables don't exist
      // Continue with empty data
    }

    const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

    const days = dates.map((date, i) => {
      const nut = nutByDate.get(date) ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      const burned = +(burnedByDate.get(date) ?? 0).toFixed(1);
      return { date, day: DAY_LABELS[i], ...nut, burned_calories: burned };
    });

    const totals = days.reduce(
      (acc, d) => ({
        calories: +(acc.calories + d.calories).toFixed(1),
        protein_g: +(acc.protein_g + d.protein_g).toFixed(2),
        carbs_g: +(acc.carbs_g + d.carbs_g).toFixed(2),
        fat_g: +(acc.fat_g + d.fat_g).toFixed(2),
        burned_calories: +(acc.burned_calories + d.burned_calories).toFixed(1),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, burned_calories: 0 }
    );

    // Fetch plan for metabolic rate (TDEE)
    const planResWeekly = await pool.query(
      `SELECT calorie_target FROM plans WHERE user_id = $1 AND active = true ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const tdeeWeekly = planResWeekly.rows[0] ? Number(planResWeekly.rows[0].calorie_target) : 0;
    const totalBurnedWeekly = (tdeeWeekly * 7) + totals.burned_calories;
    const balanceWeekly = totals.calories - totalBurnedWeekly;

    res.json({ week_start: weekStart, week_end: weekEnd, totals, days, tdee: tdeeWeekly, totalBurned: totalBurnedWeekly, balance: balanceWeekly });
  } catch (error) {
    console.error("Weekly dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch weekly data" });
  }
});

export default router;
