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

  // Get day of week for scheduled_days lookup (lowercase, e.g., "monday")
  const d = new Date(dateStr + "T00:00:00");
  const dayOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];

  // Fetch explicitly added meals from meal_plan_entries
  const entriesRes = await pool.query(
    `SELECT mpe.id AS entry_id, mpe.meal_id, true AS is_scheduled,
       (SELECT completed_at FROM meal_plan_completions mpc
        WHERE mpc.user_id = $1 AND mpc.date = $2 AND mpc.meal_id = mpe.meal_id
        LIMIT 1) AS completed_at
     FROM meal_plan_entries mpe
     WHERE mpe.user_id = $1 AND mpe.date = $2
     ORDER BY mpe.created_at`,
    [userId, dateStr]
  );

  // Fetch meals scheduled for this day of week (that aren't already in meal_plan_entries and not excluded)
  const scheduledRes = await pool.query(
    `SELECT DISTINCT ms.meal_id
     FROM meal_schedule ms
     WHERE ms.user_id = $1 
       AND ms.day_of_week = $2
       AND NOT EXISTS (
         SELECT 1 FROM meal_plan_entries mpe 
         WHERE mpe.user_id = $1 AND mpe.date = $3 AND mpe.meal_id = ms.meal_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM meal_plan_exclusions mpe 
         WHERE mpe.user_id = $1 AND mpe.date = $3 AND mpe.meal_id = ms.meal_id
       )
     ORDER BY ms.meal_id`,
    [userId, dayOfWeek, dateStr]
  );

  // Combine both sets of meal IDs
  const allMealIds = [
    ...entriesRes.rows.map(row => ({ 
      entry_id: row.entry_id, 
      meal_id: row.meal_id, 
      completed_at: row.completed_at,
      is_scheduled: true 
    })),
    ...scheduledRes.rows.map(row => ({ 
      entry_id: null, 
      meal_id: row.meal_id, 
      completed_at: null,
      is_scheduled: false 
    })),
  ];

  const entries = await Promise.all(
    allMealIds.map(async (row) => {
      const meal = await getMealSummary(row.meal_id);
      return {
        entry_id: row.entry_id ?? 0, // Scheduled meals don't have explicit entries yet
        meal,
        completed: row.completed_at !== null,
        completed_at: row.completed_at ?? null,
        is_scheduled: row.is_scheduled, // Track if this meal was added manually (true) or scheduled (false)
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

  const insertResult = await pool.query(
    `INSERT INTO meal_plan_completions (user_id, date, meal_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date, meal_id) DO NOTHING
     RETURNING id`,
    [userId, date, meal_id]
  );

  // Only deduct stock if this was a fresh completion (not a duplicate)
  if (insertResult.rowCount && insertResult.rowCount > 0) {
    const portionsRes = await pool.query(
      `SELECT mp.food_id, mp.food_source, mp.quantity_g,
              COALESCE(f.food_name, uf.food_name) AS food_name
       FROM meal_portions mp
       LEFT JOIN foods f ON f.id = mp.food_id AND mp.food_source = 'database'
       LEFT JOIN user_foods uf ON uf.id = mp.food_id AND mp.food_source = 'user'
       WHERE mp.meal_id = $1`,
      [meal_id]
    );
    for (const p of portionsRes.rows) {
      await pool.query(
        `INSERT INTO food_stock (user_id, food_id, food_source, food_name, quantity_g, updated_at)
         VALUES ($1, $2, $3, $4, 0, NOW())
         ON CONFLICT (user_id, food_id, food_source)
         DO UPDATE SET
           quantity_g = GREATEST(0, food_stock.quantity_g - $5),
           updated_at = NOW()`,
        [userId, p.food_id, p.food_source, p.food_name, Number(p.quantity_g)]
      );
    }
  }

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

  const deleteResult = await pool.query(
    "DELETE FROM meal_plan_completions WHERE user_id = $1 AND date = $2 AND meal_id = $3 RETURNING id",
    [userId, date, meal_id]
  );

  // Restore stock only if something was actually deleted
  if (deleteResult.rowCount && deleteResult.rowCount > 0) {
    const portionsRes = await pool.query(
      `SELECT mp.food_id, mp.food_source, mp.quantity_g
       FROM meal_portions mp
       WHERE mp.meal_id = $1`,
      [meal_id]
    );
    for (const p of portionsRes.rows) {
      await pool.query(
        `UPDATE food_stock
         SET quantity_g = quantity_g + $1, updated_at = NOW()
         WHERE user_id = $2 AND food_id = $3 AND food_source = $4`,
        [Number(p.quantity_g), userId, p.food_id, p.food_source]
      );
    }
  }

  res.json({ entry_id: entryId, completed: false });
});

// ── POST /meal-plan/:date/exclude/:mealId ─────────────────────────────────

router.post("/meal-plan/:date/exclude/:mealId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const date = req.params["date"];
  const mealId = Number(req.params["mealId"]);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    return;
  }

  // Add exclusion for this date/meal combo
  await pool.query(
    `INSERT INTO meal_plan_exclusions (user_id, date, meal_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date, meal_id) DO NOTHING`,
    [userId, date, mealId]
  );

  res.json({ message: "Meal excluded from this date" });
});

// ── DELETE /meal-plan/:date/exclude/:mealId ───────────────────────────────

router.delete("/meal-plan/:date/exclude/:mealId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const date = req.params["date"];
  const mealId = Number(req.params["mealId"]);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    return;
  }

  await pool.query(
    "DELETE FROM meal_plan_exclusions WHERE user_id = $1 AND date = $2 AND meal_id = $3",
    [userId, date, mealId]
  );

  res.json({ message: "Meal exclusion removed" });
});

export default router;
