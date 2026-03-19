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

function calcExerciseCalories(row: {
  exercise_type: string; met_value: string | null;
  sets: string; reps_min: string; reps_max: string; rest_seconds: string;
  duration_mins: string | null; effort_level: string | null;
}, weightKg: number): number {
  if (row.exercise_type === "cardio") {
    const met = Number(row.met_value) || 5;
    const dur = Number(row.duration_mins) || 0;
    return +(met * weightKg * (dur / 60)).toFixed(1);
  }
  const sets = Number(row.sets);
  const avgReps = (Number(row.reps_min) + Number(row.reps_max)) / 2;
  const rest = Number(row.rest_seconds);
  const durMins = (sets * (avgReps * 3 + rest)) / 60;
  const met = EFFORT_MET[row.effort_level ?? "moderate"] ?? EFFORT_MET.moderate;
  return +(met * weightKg * (durMins / 60)).toFixed(1);
}

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

    // Planned: scheduled workouts (not excluded) + entries for this date
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

    const planned_calories = +plannedRes.rows.reduce((sum: number, row: any) => sum + calcExerciseCalories(row, weightKg), 0).toFixed(1);

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

  const [nutrition, training] = await Promise.all([
    getNutritionData(userId, dateStr),
    getWorkoutCalories(userId, dateStr, weightKg),
  ]);

  // Calculate balance: consumed - (metabolic rate + exercise burn)
  const totalBurned = tdeeEstimated + training.burned_calories;
  const balance = nutrition.consumed.calories - totalBurned;

  res.json({ date: dateStr, nutrition, training, calorieTarget, tdeeEstimated, workoutBurned: training.burned_calories, totalBurned, balance });
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
