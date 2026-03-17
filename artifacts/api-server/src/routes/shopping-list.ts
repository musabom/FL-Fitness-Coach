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

// ── GET /shopping-list ─────────────────────────────────────────────────────────
// Returns per-food aggregated weekly/daily requirements from scheduled meals,
// merged with current stock levels.

router.get("/shopping-list", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  // Fetch all portions for user's meals, joined with schedule days count
  const portionsRes = await pool.query(
    `SELECT
       mp.food_id,
       mp.food_source,
       mp.quantity_g,
       COALESCE(f.food_name, uf.food_name)     AS food_name,
       COALESCE(f.food_group, 'Other')          AS food_group,
       COALESCE(f.serving_unit, uf.serving_unit) AS serving_unit,
       COUNT(DISTINCT ms.day_of_week)::int      AS days_per_week,
       um.id                                    AS meal_id,
       um.meal_name
     FROM meal_portions mp
     JOIN user_meals um ON um.id = mp.meal_id AND um.user_id = $1
     LEFT JOIN meal_schedule ms ON ms.meal_id = mp.meal_id AND ms.user_id = $1
     LEFT JOIN foods f      ON f.id  = mp.food_id AND mp.food_source = 'database'
     LEFT JOIN user_foods uf ON uf.id = mp.food_id AND mp.food_source = 'user'
     GROUP BY mp.food_id, mp.food_source, mp.quantity_g, f.food_name, uf.food_name,
              f.food_group, f.serving_unit, uf.serving_unit, um.id, um.meal_name
     ORDER BY food_name`,
    [userId]
  );

  // Aggregate across meals: same food can appear in multiple meals
  const foodMap = new Map<string, {
    food_id: number;
    food_source: string;
    food_name: string;
    food_group: string;
    serving_unit: string;
    daily_g: number;         // total per day (sum across all scheduled meals for a given day)
    weekly_g: number;        // sum of (quantity × days_scheduled) per meal contribution
    meals: { meal_id: number; meal_name: string; quantity_g: number; days_per_week: number }[];
  }>();

  for (const row of portionsRes.rows) {
    const key = `${row.food_id}::${row.food_source}`;
    const qg = Number(row.quantity_g);
    const dpw = Number(row.days_per_week);

    if (!foodMap.has(key)) {
      foodMap.set(key, {
        food_id: row.food_id,
        food_source: row.food_source,
        food_name: row.food_name,
        food_group: row.food_group,
        serving_unit: row.serving_unit,
        daily_g: 0,
        weekly_g: 0,
        meals: [],
      });
    }

    const entry = foodMap.get(key)!;
    // Only add the per-day amount if this meal is scheduled (days_per_week > 0)
    // "daily_g" = amount used on the days this food appears (averaged to a single daily value)
    // We'll record raw weekly amount instead and derive daily from weekly/7
    entry.weekly_g = +(entry.weekly_g + qg * dpw).toFixed(2);
    entry.meals.push({
      meal_id: row.meal_id,
      meal_name: row.meal_name,
      quantity_g: qg,
      days_per_week: dpw,
    });
  }

  // Fetch stock
  const stockRes = await pool.query(
    `SELECT food_id, food_source, quantity_g FROM food_stock WHERE user_id = $1`,
    [userId]
  );
  const stockMap = new Map<string, number>();
  for (const s of stockRes.rows) {
    stockMap.set(`${s.food_id}::${s.food_source}`, Number(s.quantity_g));
  }

  const items = Array.from(foodMap.values()).map(item => {
    const key = `${item.food_id}::${item.food_source}`;
    const stock = stockMap.get(key) ?? 0;
    const daily_g = item.weekly_g > 0 ? +(item.weekly_g / 7).toFixed(2) : 0;
    const needed_g = Math.max(0, +(item.weekly_g - stock).toFixed(2));
    return {
      ...item,
      daily_g,
      stock_g: stock,
      needed_g,
    };
  });

  // Sort: items needing restocking first, then alphabetically
  items.sort((a, b) => {
    if (a.needed_g > 0 && b.needed_g === 0) return -1;
    if (a.needed_g === 0 && b.needed_g > 0) return 1;
    return a.food_name.localeCompare(b.food_name);
  });

  res.json(items);
});

// ── PUT /shopping-list/stock ────────────────────────────────────────────────────
// Upsert stock quantity for a food item.

router.put("/shopping-list/stock", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { food_id, food_source, food_name, quantity_g } = req.body;

  if (!food_id || !food_name || quantity_g === undefined) {
    res.status(400).json({ error: "food_id, food_name, quantity_g required" });
    return;
  }

  await pool.query(
    `INSERT INTO food_stock (user_id, food_id, food_source, food_name, quantity_g, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, food_id, food_source)
     DO UPDATE SET quantity_g = $5, food_name = $4, updated_at = NOW()`,
    [userId, food_id, food_source ?? "database", food_name, Math.max(0, Number(quantity_g))]
  );

  res.json({ ok: true });
});

// ── POST /shopping-list/stock/deduct ───────────────────────────────────────────
// Deduct consumed amounts from stock (called when meal is completed).

router.post("/shopping-list/stock/deduct", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { meal_id } = req.body;
  if (!meal_id) { res.status(400).json({ error: "meal_id required" }); return; }

  // Get all portions for this meal
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

  res.json({ ok: true });
});

// ── POST /shopping-list/stock/restore ──────────────────────────────────────────
// Restore stock amounts (called when meal completion is undone).

router.post("/shopping-list/stock/restore", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { meal_id } = req.body;
  if (!meal_id) { res.status(400).json({ error: "meal_id required" }); return; }

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
      `UPDATE food_stock
       SET quantity_g = quantity_g + $1, updated_at = NOW()
       WHERE user_id = $2 AND food_id = $3 AND food_source = $4`,
      [Number(p.quantity_g), userId, p.food_id, p.food_source]
    );
  }

  res.json({ ok: true });
});

export default router;
