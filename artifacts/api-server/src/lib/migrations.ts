import { pool } from "@workspace/db";

export async function runMigrations(): Promise<void> {
  try {
    await runMigrationsInternal();
  } catch (err) {
    console.error("Migration encountered an error, continuing startup:", err);
  }
}

async function runMigrationsInternal(): Promise<void> {
  // ── User Tables ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      provider VARCHAR(50) NOT NULL,
      provider_id VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    DROP TABLE IF EXISTS user_profiles CASCADE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      height_cm INTEGER NOT NULL,
      weight_kg REAL NOT NULL,
      target_weight_kg REAL NOT NULL,
      age INTEGER NOT NULL,
      gender VARCHAR(20) NOT NULL,
      goal_mode VARCHAR(20) NOT NULL,
      activity_level VARCHAR(20) NOT NULL,
      training_days INTEGER NOT NULL,
      training_location VARCHAR(20) NOT NULL,
      dietary_preferences JSONB DEFAULT '[]',
      injury_flags JSONB DEFAULT '[]',
      goal_override BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id)`);

  // ── Plans Table ──────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      phase VARCHAR(50),
      snapshot_goal_mode VARCHAR(20),
      snapshot_weight_kg REAL,
      snapshot_target_weight_kg REAL,
      calorie_target INTEGER,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      tdee_estimated INTEGER,
      deficit_surplus_kcal INTEGER,
      bf_estimate_pct REAL,
      bf_source VARCHAR(50),
      weekly_expected_change_kg REAL,
      weeks_estimate_low INTEGER,
      weeks_estimate_high INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, version)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_plans_user_version ON plans(user_id, version)`);

  // ── Exercise Library ────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercises (
      id SERIAL PRIMARY KEY,
      exercise_name VARCHAR(100) NOT NULL,
      name_arabic VARCHAR(100),
      muscle_primary VARCHAR(50) NOT NULL,
      muscle_secondary TEXT[],
      exercise_type VARCHAR(20) NOT NULL,
      equipment VARCHAR(50) NOT NULL,
      injury_contraindications TEXT[],
      image_url VARCHAR(255),
      user_id INTEGER REFERENCES users(id) DEFAULT NULL,
      is_custom BOOLEAN DEFAULT FALSE,
      active BOOLEAN DEFAULT TRUE,
      met_value DECIMAL(4,1),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_muscle ON exercises(muscle_primary)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_type ON exercises(exercise_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_custom ON exercises(is_custom)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_user ON exercises(user_id)`);

  // Seed exercises (idempotent — only if table is empty)
  const { rows: existing } = await pool.query(`SELECT COUNT(*) FROM exercises WHERE is_custom = FALSE`);
  if (Number(existing[0].count) === 0) {
    await pool.query(`
      INSERT INTO exercises (exercise_name, name_arabic, muscle_primary, muscle_secondary, exercise_type, equipment, injury_contraindications) VALUES
      ('Barbell Bench Press','صدر مستوي بار','chest',ARRAY['triceps','front_deltoid'],'strength','barbell',ARRAY['shoulder']),
      ('Machine Chest Press','صدر مستوي جهاز','chest',ARRAY['triceps','front_deltoid'],'strength','machine',ARRAY['shoulder']),
      ('Dumbbell Bench Press','دامبل مستوي','chest',ARRAY['triceps','front_deltoid'],'strength','dumbbell',ARRAY['shoulder']),
      ('Decline Chest Press','صدر سفلي جهاز','chest',ARRAY['triceps'],'strength','machine',ARRAY['shoulder']),
      ('Incline Chest Press','صدر عالي جهاز','chest',ARRAY['triceps','front_deltoid'],'strength','machine',ARRAY['shoulder']),
      ('Machine Chest Fly','جهاز تفتيح صدر','chest',ARRAY['front_deltoid'],'strength','machine',ARRAY['shoulder']),
      ('Dumbbell Bicep Curl','تبادل دامبل باي','biceps',ARRAY['brachialis'],'strength','dumbbell',ARRAY[]::text[]),
      ('Barbell Bicep Curl','بار واسع باي','biceps',ARRAY['brachialis'],'strength','barbell',ARRAY[]::text[]),
      ('Hammer Curl','هامر دامبل باي','biceps',ARRAY['brachioradialis'],'strength','dumbbell',ARRAY[]::text[]),
      ('Concentration Curl','تكوير باي','biceps',ARRAY[]::text[],'strength','dumbbell',ARRAY[]::text[]),
      ('Lat Pulldown Wide Grip','سحب امامي واسع','back',ARRAY['biceps','rear_deltoid'],'strength','cable',ARRAY['shoulder']),
      ('Dumbbell Row','منشار دامبل','back',ARRAY['biceps','rear_deltoid'],'strength','dumbbell',ARRAY['lower_back']),
      ('Seated Row Machine','جهاز منشار','back',ARRAY['biceps','rear_deltoid'],'strength','machine',ARRAY['lower_back']),
      ('Close Grip Lat Pulldown','سحب امامي ضيق','back',ARRAY['biceps'],'strength','cable',ARRAY['shoulder']),
      ('Seated Cable Row','سحب ارضي بالمثلث','back',ARRAY['biceps','rear_deltoid'],'strength','cable',ARRAY['lower_back']),
      ('T-Bar Row','تي بار رو','back',ARRAY['biceps','rear_deltoid'],'strength','barbell',ARRAY['lower_back']),
      ('Back Extension','جهاز الظهر اسفل','back',ARRAY['glutes','hamstrings'],'strength','machine',ARRAY['lower_back']),
      ('Tricep Pushdown Reverse Grip','تراي عكس مسطره','triceps',ARRAY[]::text[],'strength','cable',ARRAY['shoulder']),
      ('Tricep Pushdown Rope','حبل تراي','triceps',ARRAY[]::text[],'strength','cable',ARRAY['shoulder']),
      ('Tricep Pushdown Straight Bar','مسطره ضيق','triceps',ARRAY[]::text[],'strength','cable',ARRAY['shoulder']),
      ('Overhead Tricep Extension','تراي من فوق الراس','triceps',ARRAY[]::text[],'strength','dumbbell',ARRAY['shoulder']),
      ('Tricep Dip Machine','جهاز تراي غطس','triceps',ARRAY['chest','front_deltoid'],'strength','machine',ARRAY['shoulder']),
      ('Front Raises','رفرفه امامي','shoulders',ARRAY['upper_chest'],'strength','dumbbell',ARRAY['shoulder']),
      ('Shoulder Press Machine','جهاز اكتاف','shoulders',ARRAY['triceps'],'strength','machine',ARRAY['shoulder']),
      ('Dumbbell Shoulder Press','دامبل بريس','shoulders',ARRAY['triceps'],'strength','dumbbell',ARRAY['shoulder']),
      ('Lateral Raises','رفرفه جانبي','shoulders',ARRAY[]::text[],'strength','dumbbell',ARRAY['shoulder']),
      ('Plate Front Raise','امامي بالقرص','shoulders',ARRAY['upper_chest'],'strength','barbell',ARRAY['shoulder']),
      ('Rear Delt Fly Machine','جهاز كتف خلفي','shoulders',ARRAY['rear_deltoid','upper_back'],'strength','machine',ARRAY['shoulder']),
      ('Barbell Shrugs','ترابيس بالبار','shoulders',ARRAY['traps'],'strength','barbell',ARRAY[]::text[]),
      ('Dumbbell Shrugs','ترابيس بالدامبل','shoulders',ARRAY['traps'],'strength','dumbbell',ARRAY[]::text[]),
      ('Leg Extension','رفرفه امامي ارجل','quads',ARRAY[]::text[],'strength','machine',ARRAY['knee']),
      ('Hack Squats','هاك سكوات','quads',ARRAY['glutes','hamstrings'],'strength','machine',ARRAY['knee','lower_back']),
      ('Squats','سكوات','quads',ARRAY['glutes','hamstrings'],'strength','barbell',ARRAY['knee','lower_back']),
      ('Leg Press','دفاع','quads',ARRAY['glutes','hamstrings'],'strength','machine',ARRAY['knee','lower_back']),
      ('Leg Curls','رفرفه خلفي ارجل','hamstrings',ARRAY[]::text[],'strength','machine',ARRAY['knee']),
      ('Lunges','طعن','quads',ARRAY['glutes','hamstrings'],'strength','bodyweight',ARRAY['knee']),
      ('Hip Adductor Machine','جهاز داخلي','quads',ARRAY['inner_thigh'],'strength','machine',ARRAY['knee']),
      ('Calf Raise Machine','جهاز بطات','calves',ARRAY[]::text[],'strength','machine',ARRAY[]::text[]),
      ('Treadmill Walk','سير','cardio',ARRAY[]::text[],'cardio','machine',ARRAY[]::text[]),
      ('Treadmill Run','جري','cardio',ARRAY[]::text[],'cardio','machine',ARRAY[]::text[]),
      ('Elliptical','اوبتكال','cardio',ARRAY[]::text[],'cardio','machine',ARRAY['knee']),
      ('Stationary Bike','دراجة ثابتة','cardio',ARRAY[]::text[],'cardio','machine',ARRAY['knee']),
      ('Rowing Machine','تجديف','cardio',ARRAY['back','arms'],'cardio','machine',ARRAY['lower_back']),
      ('Jump Rope','حبل القفز','cardio',ARRAY[]::text[],'cardio','bodyweight',ARRAY['knee']),
      ('Stair Climber','سلم متحرك','cardio',ARRAY['quads','glutes'],'cardio','machine',ARRAY['knee'])
    `);

    // MET values for cardio
    await pool.query(`
      UPDATE exercises SET met_value = 3.5 WHERE exercise_name = 'Treadmill Walk';
      UPDATE exercises SET met_value = 4.3 WHERE exercise_name = 'Treadmill Run';
      UPDATE exercises SET met_value = 5.5 WHERE exercise_name = 'Elliptical';
      UPDATE exercises SET met_value = 5.5 WHERE exercise_name = 'Stationary Bike';
      UPDATE exercises SET met_value = 7.0 WHERE exercise_name = 'Rowing Machine';
      UPDATE exercises SET met_value = 10.0 WHERE exercise_name = 'Jump Rope';
      UPDATE exercises SET met_value = 9.0 WHERE exercise_name = 'Stair Climber';
    `);
  }

  // Ensure met_value column exists (for existing deployments)
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS met_value DECIMAL(4,1)`);

  // ── Workout Tables ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_workouts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      workout_name VARCHAR(100) NOT NULL DEFAULT 'Workout 1',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id SERIAL PRIMARY KEY,
      workout_id INTEGER REFERENCES user_workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER REFERENCES exercises(id),
      sets INTEGER NOT NULL DEFAULT 4,
      reps_min INTEGER NOT NULL DEFAULT 12,
      reps_max INTEGER NOT NULL DEFAULT 15,
      weight_kg DECIMAL(5,1),
      rest_seconds INTEGER DEFAULT 60,
      duration_mins INTEGER,
      speed_kmh DECIMAL(4,1),
      effort_level VARCHAR(10),
      order_index INTEGER NOT NULL DEFAULT 1,
      notes VARCHAR(200)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_schedule (
      id SERIAL PRIMARY KEY,
      workout_id INTEGER REFERENCES user_workouts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      day_of_week VARCHAR(10) NOT NULL,
      CONSTRAINT valid_day CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday'))
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_workouts_user ON user_workouts(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workout_schedule_user ON workout_schedule(user_id)`);

  // ── Food & Meal Tables ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id SERIAL PRIMARY KEY,
      food_name VARCHAR(100) NOT NULL,
      food_group VARCHAR(50),
      cooking_method VARCHAR(50) DEFAULT 'custom',
      dietary_tags TEXT[] DEFAULT ARRAY[]::text[],
      serving_unit VARCHAR(20) DEFAULT 'per_100g',
      serving_weight_g REAL,
      calories REAL NOT NULL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      fibre_g REAL,
      leucine_g REAL,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS cooking_method VARCHAR(50) DEFAULT 'custom'`);
  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT ARRAY[]::text[]`);
  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`);

  // Seed common foods (idempotent — only if table is empty)
  const { rows: existingFoods } = await pool.query(`SELECT COUNT(*) FROM foods`);
  if (Number(existingFoods[0].count) === 0) {
    await pool.query(`
      INSERT INTO foods (food_name, food_group, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fibre_g, leucine_g) VALUES
      ('Chicken Breast', 'Protein', 'per_100g', 100, 165, 31, 0, 3.6, 0, 2.3),
      ('Ground Beef 80/20', 'Protein', 'per_100g', 100, 217, 23, 0, 13, 0, 1.8),
      ('Salmon', 'Protein', 'per_100g', 100, 206, 22, 0, 13, 0, 1.9),
      ('Eggs', 'Protein', 'per_piece', 1, 78, 6.3, 0.6, 5.3, 0, 0.5),
      ('Greek Yogurt', 'Dairy', 'per_100g', 100, 59, 10, 3.3, 0.4, 0, 0.8),
      ('Cottage Cheese', 'Dairy', 'per_100g', 100, 98, 11, 4.3, 5, 0, 0.9),
      ('Whole Milk', 'Dairy', 'per_100g', 100, 61, 3.2, 4.8, 3.3, 0, 0.3),
      ('Cheddar Cheese', 'Dairy', 'per_100g', 100, 403, 23, 3.3, 33, 0, 1.8),
      ('Brown Rice', 'Carbs', 'per_100g', 100, 111, 2.6, 23, 0.9, 1.8, 0.1),
      ('White Rice', 'Carbs', 'per_100g', 100, 130, 2.7, 28, 0.3, 0.4, 0.1),
      ('Sweet Potato', 'Carbs', 'per_100g', 100, 86, 1.6, 20, 0.1, 3, 0.1),
      ('Oats', 'Carbs', 'per_100g', 100, 389, 17, 66, 6.9, 10.6, 0.5),
      ('Whole Wheat Bread', 'Carbs', 'per_100g', 100, 247, 9, 43, 3.3, 7.0, 0.3),
      ('Banana', 'Carbs', 'per_piece', 1, 89, 1.1, 23, 0.3, 2.6, 0.1),
      ('Apple', 'Fruit', 'per_piece', 1, 52, 0.3, 14, 0.2, 2.4, 0.0),
      ('Broccoli', 'Vegetable', 'per_100g', 100, 34, 2.8, 7, 0.4, 2.4, 0.2),
      ('Spinach', 'Vegetable', 'per_100g', 100, 23, 2.9, 3.6, 0.4, 2.2, 0.3),
      ('Carrot', 'Vegetable', 'per_100g', 100, 41, 0.9, 10, 0.2, 2.8, 0.1),
      ('Olive Oil', 'Fat', 'per_100g', 100, 884, 0, 0, 100, 0, 0),
      ('Almonds', 'Nuts', 'per_100g', 100, 579, 21, 22, 50, 12.5, 1.1),
      ('Peanut Butter', 'Nuts', 'per_100g', 100, 588, 25, 20, 50, 6.0, 1.0),
      ('Salmon Canned', 'Protein', 'per_100g', 100, 208, 20, 0, 13, 0, 1.9),
      ('Tuna Canned', 'Protein', 'per_100g', 100, 132, 29, 0, 1.3, 0, 2.3),
      ('Chicken Thigh', 'Protein', 'per_100g', 100, 209, 26, 0, 11, 0, 1.9),
      ('Turkey Breast', 'Protein', 'per_100g', 100, 135, 29, 0, 1.6, 0, 2.4),
      ('Lean Beef', 'Protein', 'per_100g', 100, 180, 27, 0, 8, 0, 2.1),
      ('Pasta', 'Carbs', 'per_100g', 100, 371, 13, 75, 1.1, 1.8, 0.4),
      ('Potato', 'Carbs', 'per_100g', 100, 77, 2, 17, 0.1, 2.1, 0.1),
      ('Quinoa', 'Carbs', 'per_100g', 100, 368, 14, 64, 6, 7, 0.6),
      ('Lentils', 'Carbs', 'per_100g', 100, 353, 25, 63, 1.5, 10.5, 0.6),
      ('Chickpeas', 'Carbs', 'per_100g', 100, 364, 19, 61, 6, 10, 0.5),
      ('Blueberries', 'Fruit', 'per_100g', 100, 57, 0.7, 14, 0.3, 2.4, 0.1),
      ('Strawberries', 'Fruit', 'per_100g', 100, 32, 0.7, 8, 0.3, 2, 0.1),
      ('Orange', 'Fruit', 'per_piece', 1, 47, 0.9, 12, 0.3, 2.4, 0.1),
      ('Bell Pepper', 'Vegetable', 'per_100g', 100, 31, 1, 7, 0.3, 2.2, 0.2),
      ('Tomato', 'Vegetable', 'per_100g', 100, 18, 0.9, 3.9, 0.2, 1.2, 0.1),
      ('Cucumber', 'Vegetable', 'per_100g', 100, 16, 0.7, 4, 0.1, 0.5, 0.1),
      ('Avocado', 'Fat', 'per_100g', 100, 160, 2, 9, 15, 7, 0.1),
      ('Coconut Oil', 'Fat', 'per_100g', 100, 892, 0, 0, 100, 0, 0),
      ('Butter', 'Fat', 'per_100g', 100, 717, 0.7, 0.1, 81, 0, 0),
      ('Milk', 'Dairy', 'per_100g', 100, 42, 3.4, 5, 0.1, 0, 0.3)
    `);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_foods (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      food_name VARCHAR(100) NOT NULL,
      food_group VARCHAR(50),
      serving_unit VARCHAR(20) DEFAULT 'per_100g',
      serving_weight_g REAL,
      calories REAL NOT NULL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      fibre_g REAL,
      leucine_g REAL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_meals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      meal_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_portions (
      id SERIAL PRIMARY KEY,
      meal_id INTEGER REFERENCES user_meals(id) ON DELETE CASCADE,
      food_id INTEGER,
      food_source VARCHAR(20) DEFAULT 'database',
      quantity_g REAL NOT NULL,
      notes VARCHAR(200),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE meal_portions ADD COLUMN IF NOT EXISTS notes VARCHAR(200)`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(food_name)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_foods_user ON user_foods(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_meals_user ON user_meals(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meal_portions_meal ON meal_portions(meal_id)`);

  // ── Meal Scheduling & Tracking Tables ───────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_schedule (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      meal_id INTEGER REFERENCES user_meals(id) ON DELETE CASCADE,
      day_of_week VARCHAR(10) NOT NULL,
      CONSTRAINT valid_meal_day CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
      UNIQUE(user_id, meal_id, day_of_week)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      meal_id INTEGER REFERENCES user_meals(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, date, meal_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plan_completions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      meal_id INTEGER REFERENCES user_meals(id) ON DELETE CASCADE,
      completed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, date, meal_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_plan_exclusions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      meal_id INTEGER REFERENCES user_meals(id) ON DELETE CASCADE,
      UNIQUE(user_id, date, meal_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meal_portion_completions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      meal_id INTEGER REFERENCES user_meals(id) ON DELETE CASCADE,
      portion_id INTEGER REFERENCES meal_portions(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      completed_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, meal_id, portion_id, date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS food_stock (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      food_id INTEGER NOT NULL,
      food_source VARCHAR(20) NOT NULL DEFAULT 'database',
      food_name VARCHAR(100),
      quantity_g REAL NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, food_id, food_source)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meal_schedule_user ON meal_schedule(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_user_date ON meal_plan_entries(user_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meal_plan_completions_user_date ON meal_plan_completions(user_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meal_portion_completions_user_date ON meal_portion_completions(user_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_food_stock_user ON food_stock(user_id)`);
}
