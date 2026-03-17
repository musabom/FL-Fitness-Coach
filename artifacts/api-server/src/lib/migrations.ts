import { pool } from "@workspace/db";

export async function runMigrations(): Promise<void> {
  await pool.query(`
    ALTER TABLE meal_portions
      DROP CONSTRAINT IF EXISTS meal_portions_food_id_fkey
  `);

  await pool.query(`
    ALTER TABLE meal_portions
      ADD COLUMN IF NOT EXISTS notes TEXT
  `);
}
