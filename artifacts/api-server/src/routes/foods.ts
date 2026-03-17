import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

router.get("/foods/search", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const q = (req.query["q"] as string | undefined) ?? "";
  const group = req.query["group"] as string | undefined;

  let sql = `
    SELECT
      id, food_name, food_group, cooking_method,
      serving_unit, serving_weight_g,
      calories, protein_g, carbs_g, fat_g,
      leucine_g, dietary_tags
    FROM foods
    WHERE active = TRUE
      AND LOWER(food_name) LIKE LOWER($1)
  `;
  const params: unknown[] = [`%${q}%`];

  if (group) {
    params.push(group);
    sql += ` AND food_group = $${params.length}`;
  }

  sql += " ORDER BY food_name, cooking_method LIMIT 20";

  const result = await pool.query(sql, params);
  const foods = result.rows.map(row => ({
    id: row.id,
    food_name: row.food_name,
    food_group: row.food_group,
    cooking_method: row.cooking_method,
    serving_unit: row.serving_unit,
    serving_weight_g: Number(row.serving_weight_g),
    calories: Number(row.calories),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    leucine_g: Number(row.leucine_g),
    dietary_tags: row.dietary_tags,
  }));
  res.json(foods);
});

export default router;
