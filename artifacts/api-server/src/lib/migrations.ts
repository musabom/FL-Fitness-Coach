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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date       DATE    NOT NULL,
      meal_id    INTEGER NOT NULL REFERENCES user_meals(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, date, meal_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plan_completions (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date         DATE    NOT NULL,
      meal_id      INTEGER NOT NULL REFERENCES user_meals(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, date, meal_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plan_exclusions (
      id      SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date    DATE    NOT NULL,
      meal_id INTEGER NOT NULL REFERENCES user_meals(id) ON DELETE CASCADE,
      UNIQUE (user_id, date, meal_id)
    )
  `);
}
