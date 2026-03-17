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

router.get("/foods/search", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const q = (req.query["q"] as string | undefined) ?? "";

  // Search database foods
  let sql = `
    SELECT
      id, food_name, food_group, cooking_method,
      serving_unit, serving_weight_g,
      calories, protein_g, carbs_g, fat_g,
      leucine_g, dietary_tags,
      'database' as source
    FROM foods
    WHERE active = TRUE
      AND LOWER(food_name) LIKE LOWER($1)
    LIMIT 500
  `;
  const params: unknown[] = [`%${q}%`];

  const dbResult = await pool.query(sql, params);
  const dbFoods = dbResult.rows.map(row => ({
    id: row.id,
    food_name: row.food_name,
    food_group: row.food_group,
    cooking_method: row.cooking_method || "",
    serving_unit: row.serving_unit,
    serving_weight_g: Number(row.serving_weight_g),
    calories: Number(row.calories),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    leucine_g: Number(row.leucine_g),
    dietary_tags: row.dietary_tags || [],
    source: "database",
  }));

  // Search user foods
  const userSql = `
    SELECT
      id, food_name, food_group,
      serving_unit, serving_weight_g,
      calories, protein_g, carbs_g, fat_g,
      leucine_g,
      'user' as source
    FROM user_foods
    WHERE user_id = $1
      AND LOWER(food_name) LIKE LOWER($2)
    LIMIT 500
  `;
  
  const userResult = await pool.query(userSql, [userId, `%${q}%`]);
  const userFoods = userResult.rows.map(row => ({
    id: row.id,
    food_name: row.food_name,
    food_group: row.food_group || "Custom",
    cooking_method: "custom",
    serving_unit: row.serving_unit,
    serving_weight_g: Number(row.serving_weight_g) || (row.serving_unit === "per_piece" ? 1 : 100),
    calories: Number(row.calories),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    leucine_g: Number(row.leucine_g),
    dietary_tags: [],
    source: "user",
  }));

  // Combine and return
  const allFoods = [...dbFoods, ...userFoods];
  res.json(allFoods);
});

// POST /foods/custom - Create user custom food
router.post("/foods/custom", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { food_name, food_group, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fibre_g, leucine_g } = req.body as {
    food_name?: string;
    food_group?: string;
    serving_unit?: string;
    serving_weight_g?: number;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fibre_g?: number;
    leucine_g?: number;
  };

  if (!food_name?.trim() || !serving_unit || calories === undefined || protein_g === undefined || carbs_g === undefined || fat_g === undefined) {
    res.status(400).json({ error: "food_name, serving_unit, calories, protein_g, carbs_g, fat_g are required" });
    return;
  }

  if (!["per_100g", "per_piece"].includes(serving_unit)) {
    res.status(400).json({ error: "serving_unit must be 'per_100g' or 'per_piece'" });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO user_foods (user_id, food_name, food_group, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fibre_g, leucine_g)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, food_name, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, leucine_g`,
      [userId, food_name.trim(), food_group || null, serving_unit, serving_weight_g || null, calories, protein_g, carbs_g, fat_g, fibre_g || null, leucine_g || null]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      food_name: row.food_name,
      food_group: food_group || "Custom",
      cooking_method: "custom",
      serving_unit: row.serving_unit,
      serving_weight_g: Number(row.serving_weight_g),
      calories: Number(row.calories),
      protein_g: Number(row.protein_g),
      carbs_g: Number(row.carbs_g),
      fat_g: Number(row.fat_g),
      leucine_g: Number(row.leucine_g),
      dietary_tags: [],
      source: "user",
    });
  } catch (error: any) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Food with this name already exists for this user" });
    } else {
      throw error;
    }
  }
});

export default router;
