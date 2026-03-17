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

function calcPortion(food: {
  serving_unit: string; serving_weight_g: number;
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
}, quantityG: number) {
  const multiplier = food.serving_unit === "per_piece" ? quantityG : quantityG / 100;
  return {
    calories: +(food.calories * multiplier).toFixed(1),
    protein_g: +(food.protein_g * multiplier).toFixed(2),
    carbs_g: +(food.carbs_g * multiplier).toFixed(2),
    fat_g: +(food.fat_g * multiplier).toFixed(2),
  };
}

function sumMacros(portions: ReturnType<typeof calcPortion>[]) {
  return portions.reduce(
    (acc, p) => ({
      calories: +(acc.calories + p.calories).toFixed(1),
      protein_g: +(acc.protein_g + p.protein_g).toFixed(2),
      carbs_g: +(acc.carbs_g + p.carbs_g).toFixed(2),
      fat_g: +(acc.fat_g + p.fat_g).toFixed(2),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

async function getMealSummary(mealId: number) {
  const mealRes = await pool.query(
    `SELECT id, meal_name FROM user_meals WHERE id = $1`,
    [mealId]
  );
  if (!mealRes.rows.length) return null;

  const portionsRes = await pool.query(
    `SELECT mp.id, mp.quantity_g, mp.food_source, mp.notes,
       COALESCE(f.food_name, uf.food_name) AS food_name,
       COALESCE(f.serving_unit, uf.serving_unit) AS serving_unit,
       COALESCE(f.serving_weight_g, uf.serving_weight_g) AS serving_weight_g,
       COALESCE(f.calories, uf.calories) AS calories,
       COALESCE(f.protein_g, uf.protein_g) AS protein_g,
       COALESCE(f.carbs_g, uf.carbs_g) AS carbs_g,
       COALESCE(f.fat_g, uf.fat_g) AS fat_g
     FROM meal_portions mp
     LEFT JOIN foods f ON f.id = mp.food_id AND mp.food_source = 'database'
     LEFT JOIN user_foods uf ON uf.id = mp.food_id AND mp.food_source = 'user'
     WHERE mp.meal_id = $1
     ORDER BY mp.id`,
    [mealId]
  );

  const portions = portionsRes.rows.map((row) => {
    const macros = calcPortion(row, Number(row.quantity_g));
    return {
      id: row.id,
      food_name: row.food_name,
      quantity_g: Number(row.quantity_g),
      serving_unit: row.serving_unit,
      notes: row.notes ?? null,
      ...macros,
    };
  });

  const totals = sumMacros(portions);

  return {
    id: mealRes.rows[0].id,
    meal_name: mealRes.rows[0].meal_name,
    portions,
    totals,
  };
}

// ── GET /meal-plan?date=YYYY-MM-DD ────────────────────────────────────────────

router.get("/meal-plan", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const dateStr = (req.query["date"] as string) || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    return;
  }

  const entriesRes = await pool.query(
    `SELECT mpe.id AS entry_id, mpe.meal_id,
       (SELECT completed_at FROM meal_plan_completions mpc
        WHERE mpc.user_id = $1 AND mpc.date = $2 AND mpc.meal_id = mpe.meal_id
        LIMIT 1) AS completed_at
     FROM meal_plan_entries mpe
     WHERE mpe.user_id = $1 AND mpe.date = $2
     ORDER BY mpe.created_at`,
    [userId, dateStr]
  );

  const entries = await Promise.all(
    entriesRes.rows.map(async (row) => {
      const meal = await getMealSummary(row.meal_id);
      return {
        entry_id: row.entry_id,
        meal,
        completed: row.completed_at !== null,
        completed_at: row.completed_at ?? null,
      };
    })
  );

  const dailyTotals = sumMacros(
    entries
      .filter((e) => e.meal !== null)
      .map((e) => e.meal!.totals)
  );

  res.json({ date: dateStr, entries, daily_totals: dailyTotals });
});

// ── POST /meal-plan ───────────────────────────────────────────────────────────

router.post("/meal-plan", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { date, meal_id } = req.body as { date?: string; meal_id?: number };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
    return;
  }
  if (!meal_id) {
    res.status(400).json({ error: "meal_id is required" });
    return;
  }

  const ownerCheck = await pool.query(
    "SELECT id FROM user_meals WHERE id = $1 AND user_id = $2",
    [meal_id, userId]
  );
  if (!ownerCheck.rows.length) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO meal_plan_entries (user_id, date, meal_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date, meal_id) DO NOTHING
     RETURNING id`,
    [userId, date, meal_id]
  );

  if (!result.rows.length) {
    res.status(409).json({ error: "Meal already added to this day" });
    return;
  }

  res.status(201).json({ entry_id: result.rows[0].id, date, meal_id });
});

// ── DELETE /meal-plan/:entryId ────────────────────────────────────────────────

router.delete("/meal-plan/:entryId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const entryId = Number(req.params["entryId"]);

  const check = await pool.query(
    "SELECT id, date, meal_id FROM meal_plan_entries WHERE id = $1 AND user_id = $2",
    [entryId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const { date, meal_id } = check.rows[0];
  await pool.query("DELETE FROM meal_plan_entries WHERE id = $1", [entryId]);
  await pool.query(
    "DELETE FROM meal_plan_completions WHERE user_id = $1 AND date = $2 AND meal_id = $3",
    [userId, date, meal_id]
  );

  res.json({ message: "Removed" });
});

// ── POST /meal-plan/:entryId/complete ─────────────────────────────────────────

router.post("/meal-plan/:entryId/complete", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const entryId = Number(req.params["entryId"]);

  const check = await pool.query(
    "SELECT date, meal_id FROM meal_plan_entries WHERE id = $1 AND user_id = $2",
    [entryId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const { date, meal_id } = check.rows[0];

  await pool.query(
    `INSERT INTO meal_plan_completions (user_id, date, meal_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date, meal_id) DO NOTHING`,
    [userId, date, meal_id]
  );

  res.json({ entry_id: entryId, completed: true });
});

// ── DELETE /meal-plan/:entryId/complete ───────────────────────────────────────

router.delete("/meal-plan/:entryId/complete", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const entryId = Number(req.params["entryId"]);

  const check = await pool.query(
    "SELECT date, meal_id FROM meal_plan_entries WHERE id = $1 AND user_id = $2",
    [entryId, userId]
  );
  if (!check.rows.length) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const { date, meal_id } = check.rows[0];

  await pool.query(
    "DELETE FROM meal_plan_completions WHERE user_id = $1 AND date = $2 AND meal_id = $3",
    [userId, date, meal_id]
  );

  res.json({ entry_id: entryId, completed: false });
});

export default router;
