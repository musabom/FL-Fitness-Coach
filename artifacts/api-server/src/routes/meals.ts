import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

function requireAuth(req: import("express").Request, res: import("express").Response): number | null {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.session.userId;
}

// ── Macro calculation ─────────────────────────────────────────────────────────

interface FoodRow {
  serving_unit: string;
  serving_weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  leucine_g: number | null;
}

function calcPortion(food: FoodRow, quantityG: number) {
  const multiplier =
    food.serving_unit === "per_piece"
      ? quantityG
      : quantityG / 100;
  return {
    calories: +(food.calories * multiplier).toFixed(1),
    protein_g: +(food.protein_g * multiplier).toFixed(2),
    carbs_g: +(food.carbs_g * multiplier).toFixed(2),
    fat_g: +(food.fat_g * multiplier).toFixed(2),
    fibre_g: +((food.fibre_g ?? 0) * multiplier).toFixed(2),
    leucine_g: +((food.leucine_g ?? 0) * multiplier).toFixed(3),
  };
}

function sumMacros(portions: ReturnType<typeof calcPortion>[]) {
  return portions.reduce(
    (acc, p) => ({
      calories: +(acc.calories + p.calories).toFixed(1),
      protein_g: +(acc.protein_g + p.protein_g).toFixed(2),
      carbs_g: +(acc.carbs_g + p.carbs_g).toFixed(2),
      fat_g: +(acc.fat_g + p.fat_g).toFixed(2),
      fibre_g: +(acc.fibre_g + p.fibre_g).toFixed(2),
      leucine_g: +(acc.leucine_g + p.leucine_g).toFixed(3),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, leucine_g: 0 }
  );
}

// ── Shared query: fetch full meal with portions & macros ──────────────────────

async function getMealWithPortions(mealId: number) {
  const portionsRes = await pool.query(
    `SELECT
       mp.id, mp.quantity_g,
       f.id AS food_id, f.food_name, f.food_group, f.cooking_method,
       f.serving_unit, f.serving_weight_g,
       f.calories, f.protein_g, f.carbs_g, f.fat_g, f.fibre_g, f.leucine_g,
       f.dietary_tags
     FROM meal_portions mp
     JOIN foods f ON f.id = mp.food_id
     WHERE mp.meal_id = $1
     ORDER BY mp.id`,
    [mealId]
  );

  const portions = portionsRes.rows.map((row) => {
    const macros = calcPortion(row, Number(row.quantity_g));
    return {
      id: row.id,
      food_id: row.food_id,
      food_name: row.food_name,
      food_group: row.food_group,
      cooking_method: row.cooking_method,
      serving_unit: row.serving_unit,
      serving_weight_g: Number(row.serving_weight_g),
      quantity_g: Number(row.quantity_g),
      dietary_tags: row.dietary_tags,
      ...macros,
    };
  });

  const totals = sumMacros(portions.map((p) => ({
    calories: p.calories,
    protein_g: p.protein_g,
    carbs_g: p.carbs_g,
    fat_g: p.fat_g,
    fibre_g: p.fibre_g,
    leucine_g: p.leucine_g,
  })));

  return { portions, totals };
}

async function getMealById(mealId: number) {
  const mealRes = await pool.query(
    `SELECT m.id, m.meal_name, m.created_at, m.updated_at,
       COALESCE(json_agg(ms.day_of_week) FILTER (WHERE ms.id IS NOT NULL), '[]') AS scheduled_days
     FROM user_meals m
     LEFT JOIN meal_schedule ms ON ms.meal_id = m.id
     WHERE m.id = $1
     GROUP BY m.id`,
    [mealId]
  );
  if (!mealRes.rows.length) return null;
  const meal = mealRes.rows[0];
  const { portions, totals } = await getMealWithPortions(mealId);
  return {
    id: meal.id,
    meal_name: meal.meal_name,
    created_at: meal.created_at,
    updated_at: meal.updated_at,
    scheduled_days: meal.scheduled_days,
    portions,
    totals,
  };
}

// ── Validation helpers ────────────────────────────────────────────────────────

async function getActivePlanTargets(userId: number) {
  const res = await pool.query(
    `SELECT p.calorie_target, p.protein_g, p.carbs_g, p.fat_g
     FROM plans p
     WHERE p.user_id = $1 AND p.active = TRUE
     LIMIT 1`,
    [userId]
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return {
    calorie_target: Number(row.calorie_target),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
  };
}

async function getTodaysTotals(userId: number): Promise<{
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
}> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const res = await pool.query(
    `SELECT
       mp.quantity_g,
       f.serving_unit, f.serving_weight_g,
       f.calories, f.protein_g, f.carbs_g, f.fat_g, f.fibre_g, f.leucine_g
     FROM meal_schedule ms
     JOIN user_meals m ON m.id = ms.meal_id
     JOIN meal_portions mp ON mp.meal_id = ms.meal_id
     JOIN foods f ON f.id = mp.food_id
     WHERE ms.user_id = $1 AND ms.day_of_week = $2`,
    [userId, today]
  );

  const portionMacros = res.rows.map((row) => calcPortion(row, Number(row.quantity_g)));
  return sumMacros(portionMacros);
}

function buildWarnings(
  dailyTotals: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  plan: { calorie_target: number; protein_g: number; carbs_g: number; fat_g: number },
  singleFoodCaloriesPct?: number
): string[] {
  const warnings: string[] = [];
  if (dailyTotals.calories > plan.calorie_target * 1.03)
    warnings.push("You have exceeded your daily calorie target");
  if (dailyTotals.protein_g > plan.protein_g * 1.05)
    warnings.push("You have exceeded your daily protein target");
  if (dailyTotals.carbs_g > plan.carbs_g * 1.05)
    warnings.push("You have exceeded your daily carb target");
  if (dailyTotals.fat_g > plan.fat_g * 1.05)
    warnings.push("You have exceeded your daily fat target");
  if (singleFoodCaloriesPct !== undefined && singleFoodCaloriesPct > 0.40)
    warnings.push("One food is providing more than 40% of your daily calories. Consider adding more variety.");
  return warnings;
}

// ── GET /meals ────────────────────────────────────────────────────────────────

router.get("/meals", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const mealsRes = await pool.query(
    `SELECT m.id, m.meal_name, m.created_at, m.updated_at,
       COALESCE(json_agg(ms.day_of_week) FILTER (WHERE ms.id IS NOT NULL), '[]') AS scheduled_days
     FROM user_meals m
     LEFT JOIN meal_schedule ms ON ms.meal_id = m.id
     WHERE m.user_id = $1
     GROUP BY m.id
     ORDER BY m.id`,
    [userId]
  );

  const meals = await Promise.all(
    mealsRes.rows.map(async (meal) => {
      const { portions, totals } = await getMealWithPortions(meal.id);
      return {
        id: meal.id,
        meal_name: meal.meal_name,
        created_at: meal.created_at,
        updated_at: meal.updated_at,
        scheduled_days: meal.scheduled_days,
        portions,
        totals,
      };
    })
  );

  res.json(meals);
});

// ── POST /meals ───────────────────────────────────────────────────────────────

router.post("/meals", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const countRes = await pool.query(
    "SELECT COUNT(*) as cnt FROM user_meals WHERE user_id = $1",
    [userId]
  );
  const count = Number(countRes.rows[0].cnt);
  const mealName = `Meal ${count + 1}`;

  const result = await pool.query(
    "INSERT INTO user_meals (user_id, meal_name) VALUES ($1, $2) RETURNING *",
    [userId, mealName]
  );
  const meal = result.rows[0];
  res.status(201).json({ id: meal.id, meal_name: meal.meal_name, created_at: meal.created_at, scheduled_days: [], portions: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } });
});

// ── PATCH /meals/:id ──────────────────────────────────────────────────────────

router.patch("/meals/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const mealId = Number(req.params["id"]);

  const ownerCheck = await pool.query(
    "SELECT id FROM user_meals WHERE id = $1 AND user_id = $2",
    [mealId, userId]
  );
  if (!ownerCheck.rows.length) { res.status(404).json({ error: "Meal not found" }); return; }

  const { meal_name } = req.body as { meal_name?: string };
  if (!meal_name?.trim()) { res.status(400).json({ error: "meal_name is required" }); return; }

  await pool.query(
    "UPDATE user_meals SET meal_name = $1, updated_at = NOW() WHERE id = $2",
    [meal_name.trim(), mealId]
  );
  res.json({ id: mealId, meal_name: meal_name.trim() });
});

// ── DELETE /meals/:id ─────────────────────────────────────────────────────────

router.delete("/meals/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const mealId = Number(req.params["id"]);

  const ownerCheck = await pool.query(
    "SELECT id FROM user_meals WHERE id = $1 AND user_id = $2",
    [mealId, userId]
  );
  if (!ownerCheck.rows.length) { res.status(404).json({ error: "Meal not found" }); return; }

  await pool.query("DELETE FROM user_meals WHERE id = $1", [mealId]);
  res.json({ message: "Meal deleted" });
});

// ── POST /meals/:id/portions ──────────────────────────────────────────────────

router.post("/meals/:id/portions", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const mealId = Number(req.params["id"]);

  const ownerCheck = await pool.query(
    "SELECT id FROM user_meals WHERE id = $1 AND user_id = $2",
    [mealId, userId]
  );
  if (!ownerCheck.rows.length) { res.status(404).json({ error: "Meal not found" }); return; }

  const { food_id, quantity_g } = req.body as { food_id?: number; quantity_g?: number };
  if (!food_id || !quantity_g || quantity_g <= 0) {
    res.status(400).json({ error: "food_id and quantity_g (> 0) are required" });
    return;
  }

  const foodCheck = await pool.query("SELECT id FROM foods WHERE id = $1", [food_id]);
  if (!foodCheck.rows.length) { res.status(404).json({ error: "Food not found" }); return; }

  await pool.query(
    "INSERT INTO meal_portions (meal_id, food_id, quantity_g) VALUES ($1, $2, $3)",
    [mealId, food_id, quantity_g]
  );

  const meal = await getMealById(mealId);
  const plan = await getActivePlanTargets(userId);
  const dailyTotals = await getTodaysTotals(userId);
  const warnings: string[] = plan ? buildWarnings(dailyTotals, plan) : [];

  res.status(201).json({ meal, warnings });
});

// ── DELETE /meals/:id/portions/:portionId ──────────────────────────────────────

router.delete("/meals/:id/portions/:portionId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const mealId = Number(req.params["id"]);
  const portionId = Number(req.params["portionId"]);

  const ownerCheck = await pool.query(
    "SELECT m.id FROM user_meals m JOIN meal_portions mp ON mp.meal_id = m.id WHERE m.id = $1 AND m.user_id = $2 AND mp.id = $3",
    [mealId, userId, portionId]
  );
  if (!ownerCheck.rows.length) { res.status(404).json({ error: "Portion not found" }); return; }

  await pool.query("DELETE FROM meal_portions WHERE id = $1", [portionId]);

  const meal = await getMealById(mealId);
  res.json({ meal });
});

// ── PATCH /meals/:id/portions/:portionId ───────────────────────────────────────

router.patch("/meals/:id/portions/:portionId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const mealId = Number(req.params["id"]);
  const portionId = Number(req.params["portionId"]);

  const ownerCheck = await pool.query(
    "SELECT m.id FROM user_meals m JOIN meal_portions mp ON mp.meal_id = m.id WHERE m.id = $1 AND m.user_id = $2 AND mp.id = $3",
    [mealId, userId, portionId]
  );
  if (!ownerCheck.rows.length) { res.status(404).json({ error: "Portion not found" }); return; }

  const { quantity_g } = req.body as { quantity_g?: number };
  if (!quantity_g || quantity_g <= 0) { res.status(400).json({ error: "quantity_g (> 0) is required" }); return; }

  await pool.query("UPDATE meal_portions SET quantity_g = $1 WHERE id = $2", [quantity_g, portionId]);

  const meal = await getMealById(mealId);
  const plan = await getActivePlanTargets(userId);
  const dailyTotals = await getTodaysTotals(userId);
  const warnings: string[] = plan ? buildWarnings(dailyTotals, plan) : [];

  res.json({ meal, warnings });
});

// ── POST /meals/:id/schedule ───────────────────────────────────────────────────

router.post("/meals/:id/schedule", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const mealId = Number(req.params["id"]);

  const ownerCheck = await pool.query(
    "SELECT id FROM user_meals WHERE id = $1 AND user_id = $2",
    [mealId, userId]
  );
  if (!ownerCheck.rows.length) { res.status(404).json({ error: "Meal not found" }); return; }

  const { days } = req.body as { days?: string[] };
  const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const filteredDays = (days ?? []).filter((d) => validDays.includes(d));

  await pool.query("DELETE FROM meal_schedule WHERE meal_id = $1", [mealId]);

  if (filteredDays.length > 0) {
    const inserts = filteredDays.map((_, i) => `($1, $2, $${i + 3})`).join(", ");
    await pool.query(
      `INSERT INTO meal_schedule (meal_id, user_id, day_of_week) VALUES ${inserts}`,
      [mealId, userId, ...filteredDays]
    );
  }

  res.json({ meal_id: mealId, scheduled_days: filteredDays });
});

// ── GET /meals/day/:day ────────────────────────────────────────────────────────

router.get("/meals/day/:day", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const day = req.params["day"]?.toLowerCase();

  const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  if (!validDays.includes(day)) { res.status(400).json({ error: "Invalid day" }); return; }

  const mealsRes = await pool.query(
    `SELECT m.id FROM user_meals m
     JOIN meal_schedule ms ON ms.meal_id = m.id
     WHERE ms.user_id = $1 AND ms.day_of_week = $2
     ORDER BY m.id`,
    [userId, day]
  );

  const meals = await Promise.all(mealsRes.rows.map((r) => getMealById(r.id)));
  res.json(meals.filter(Boolean));
});

// ── GET /meals/daily-totals ────────────────────────────────────────────────────

router.get("/meals/daily-totals", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const dailyTotals = await getTodaysTotals(userId);
  const plan = await getActivePlanTargets(userId);

  if (!plan) {
    res.json({ day: today, totals: dailyTotals, targets: null, warnings: [] });
    return;
  }

  // Check single-food dominance across today's schedule
  const foodCalRes = await pool.query(
    `SELECT
       f.id AS food_id, f.food_name,
       SUM(
         CASE WHEN f.serving_unit = 'per_piece' THEN (mp.quantity_g / f.serving_weight_g)
              ELSE (mp.quantity_g / 100) END * f.calories
       ) AS food_calories
     FROM meal_schedule ms
     JOIN meal_portions mp ON mp.meal_id = ms.meal_id
     JOIN foods f ON f.id = mp.food_id
     WHERE ms.user_id = $1 AND ms.day_of_week = $2
     GROUP BY f.id, f.food_name`,
    [userId, today]
  );

  let maxSingleFoodPct = 0;
  if (dailyTotals.calories > 0) {
    for (const row of foodCalRes.rows) {
      const pct = Number(row.food_calories) / dailyTotals.calories;
      if (pct > maxSingleFoodPct) maxSingleFoodPct = pct;
    }
  }

  const warnings = buildWarnings(dailyTotals, plan, maxSingleFoodPct);

  res.json({
    day: today,
    totals: dailyTotals,
    targets: plan,
    progress: {
      calories_pct: plan.calorie_target > 0 ? Math.round((dailyTotals.calories / plan.calorie_target) * 100) : 0,
      protein_pct: plan.protein_g > 0 ? Math.round((dailyTotals.protein_g / plan.protein_g) * 100) : 0,
      carbs_pct: plan.carbs_g > 0 ? Math.round((dailyTotals.carbs_g / plan.carbs_g) * 100) : 0,
      fat_pct: plan.fat_g > 0 ? Math.round((dailyTotals.fat_g / plan.fat_g) * 100) : 0,
    },
    warnings,
  });
});

export default router;
