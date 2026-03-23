import { pool } from "@workspace/db";

export async function runMigrations(): Promise<void> {
  try {
    await runMigrationsInternal();
  } catch (err) {
    console.error("Migration encountered an error, continuing startup:", err);
  }
}

async function runMigrationsInternal(): Promise<void> {
  // ── Enum Safety ──────────────────────────────────────────────────────────────
  // goal_mode is stored as VARCHAR(20) in this schema, but some deployments may
  // use a native PostgreSQL enum type. This block safely adds 'custom' if the
  // type exists; it is a no-op otherwise.
  await pool.query(`
    DO $$ BEGIN
      ALTER TYPE goal_mode ADD VALUE IF NOT EXISTS 'custom';
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END $$;
  `);

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

  await pool.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_protein_per_kg REAL`);
  await pool.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_fat_per_kg REAL`);
  await pool.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_deficit_kcal INTEGER`);

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

  // ── Workout Plan Tables ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_plan_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      workout_id INTEGER REFERENCES user_workouts(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, date, workout_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_plan_completions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      workout_id INTEGER REFERENCES user_workouts(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      UNIQUE(user_id, workout_id, date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_plan_exclusions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      workout_id INTEGER REFERENCES user_workouts(id) ON DELETE CASCADE,
      UNIQUE(user_id, date, workout_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_exercise_completions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      workout_id INTEGER REFERENCES user_workouts(id) ON DELETE CASCADE,
      workout_exercise_id INTEGER REFERENCES workout_exercises(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      UNIQUE(user_id, workout_id, workout_exercise_id, date)
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workout_plan_entries_user_date ON workout_plan_entries(user_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workout_plan_completions_user_date ON workout_plan_completions(user_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workout_exercise_completions_user_date ON workout_exercise_completions(user_id, date)`);

  // ── Food & Meal Tables ───────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id SERIAL PRIMARY KEY,
      food_name VARCHAR(100) NOT NULL,
      food_group VARCHAR(50) NOT NULL,
      cooking_method VARCHAR(50) NOT NULL,
      fdc_id VARCHAR(20),
      serving_unit VARCHAR(30) NOT NULL,
      serving_weight_g DECIMAL(6,1),
      calories DECIMAL(6,1) NOT NULL,
      protein_g DECIMAL(5,2) NOT NULL,
      carbs_g DECIMAL(5,2) NOT NULL,
      fat_g DECIMAL(5,2) NOT NULL,
      fibre_g DECIMAL(5,2),
      sugar_g DECIMAL(5,2),
      sodium_mg DECIMAL(7,1),
      leucine_g DECIMAL(5,3),
      gi_index INTEGER,
      weigh_when VARCHAR(20) NOT NULL,
      dietary_tags TEXT[] DEFAULT ARRAY[]::text[],
      active BOOLEAN DEFAULT TRUE,
      notes VARCHAR(200),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS sugar_g DECIMAL(5,2)`);
  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS sodium_mg DECIMAL(7,1)`);
  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS gi_index INTEGER`);
  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS weigh_when VARCHAR(20)`);
  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS fdc_id VARCHAR(20)`);
  await pool.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS notes VARCHAR(200)`);

  // Seed USDA foods (idempotent — only if table is empty)
  const { rows: existingFoods } = await pool.query(`SELECT COUNT(*) FROM foods`);
  if (Number(existingFoods[0].count) === 0) {
    await pool.query(`
      INSERT INTO foods (food_name, food_group, cooking_method, fdc_id, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g, sodium_mg, leucine_g, gi_index, weigh_when, dietary_tags) VALUES
      ('Egg Whole', 'protein', 'raw', '171287', 'per_piece', 50.0, 72.0, 6.28, 0.36, 4.80, 0.00, 0.19, 71.0, 0.546, 0, 'raw', ARRAY['vegetarian','gluten_free','halal']),
      ('Egg Whole', 'protein', 'boiled', '173424', 'per_piece', 50.0, 78.0, 6.29, 0.56, 5.30, 0.00, 0.56, 62.0, 0.546, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
      ('Egg Whole', 'protein', 'fried', '173423', 'per_piece', 46.0, 90.0, 6.27, 0.38, 6.83, 0.00, 0.38, 95.0, 0.524, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
      ('Egg Whole', 'protein', 'scrambled', '173425', 'per_piece', 61.0, 91.0, 6.09, 0.98, 6.70, 0.00, 0.87, 88.0, 0.510, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
      ('Egg Whole', 'protein', 'poached', '172186', 'per_piece', 50.0, 72.0, 6.24, 0.38, 4.84, 0.00, 0.38, 147.0, 0.522, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
      ('Egg White', 'protein', 'raw', '172183', 'per_piece', 33.0, 17.0, 3.60, 0.24, 0.06, 0.00, 0.23, 55.0, 0.291, 0, 'raw', ARRAY['vegetarian','gluten_free','halal','dairy_free']),
      ('Egg White', 'protein', 'cooked', '172183', 'per_piece', 33.0, 17.0, 3.56, 0.24, 0.06, 0.00, 0.24, 56.0, 0.291, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal','dairy_free']),
      ('Chicken Breast', 'protein', 'raw', '171077', 'per_100g', 100.0, 120.0, 22.50, 0.00, 2.62, 0.00, 0.00, 45.0, 1.730, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
      ('Chicken Breast', 'protein', 'grilled', '171140', 'per_100g', 100.0, 165.0, 31.02, 0.00, 3.60, 0.00, 0.00, 74.0, 2.390, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Chicken Breast', 'protein', 'boiled', '171478', 'per_100g', 100.0, 151.0, 28.93, 0.00, 3.04, 0.00, 0.00, 56.0, 2.220, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Chicken Breast', 'protein', 'baked', '171140', 'per_100g', 100.0, 165.0, 31.00, 0.00, 3.60, 0.00, 0.00, 74.0, 2.390, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Turkey Breast', 'protein', 'raw', '171473', 'per_100g', 100.0, 114.0, 23.68, 0.00, 1.48, 0.00, 0.00, 49.0, 1.820, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
      ('Turkey Breast', 'protein', 'roasted', '171479', 'per_100g', 100.0, 135.0, 30.10, 0.00, 0.70, 0.00, 0.00, 54.0, 2.310, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Tuna', 'protein', 'canned_in_water', '173709', 'per_100g', 100.0, 86.0, 19.44, 0.00, 1.01, 0.00, 0.00, 247.0, 1.550, 0, 'as_is', ARRAY['halal','gluten_free','dairy_free']),
      ('Tuna', 'protein', 'canned_in_oil', '173708', 'per_100g', 100.0, 198.0, 29.13, 0.00, 8.21, 0.00, 0.00, 354.0, 2.330, 0, 'as_is', ARRAY['halal','gluten_free','dairy_free']),
      ('White Fish Fillet', 'protein', 'raw', '175174', 'per_100g', 100.0, 96.0, 20.08, 0.00, 1.70, 0.00, 0.00, 52.0, 1.590, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
      ('White Fish Fillet', 'protein', 'grilled', '175180', 'per_100g', 100.0, 128.0, 26.15, 0.00, 2.65, 0.00, 0.00, 56.0, 2.080, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('White Fish Fillet', 'protein', 'baked', '175180', 'per_100g', 100.0, 128.0, 26.15, 0.00, 2.65, 0.00, 0.00, 56.0, 2.080, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Salmon', 'protein', 'raw', '175167', 'per_100g', 100.0, 208.0, 20.42, 0.00, 13.42, 0.00, 0.00, 59.0, 1.620, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
      ('Salmon', 'protein', 'grilled', '175168', 'per_100g', 100.0, 206.0, 22.10, 0.00, 12.35, 0.00, 0.00, 61.0, 1.800, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Salmon', 'protein', 'baked', '175168', 'per_100g', 100.0, 206.0, 22.10, 0.00, 12.35, 0.00, 0.00, 61.0, 1.800, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Shrimp', 'protein', 'raw', '175177', 'per_100g', 100.0, 85.0, 20.10, 0.91, 0.51, 0.00, 0.00, 119.0, 1.600, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
      ('Shrimp', 'protein', 'boiled', '175171', 'per_100g', 100.0, 99.0, 20.91, 0.22, 1.01, 0.00, 0.00, 224.0, 1.660, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Beef Ground Lean 95pct', 'protein', 'raw', '171790', 'per_100g', 100.0, 137.0, 21.41, 0.00, 5.04, 0.00, 0.00, 66.0, 1.690, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
      ('Beef Ground Lean 95pct', 'protein', 'cooked', '174028', 'per_100g', 100.0, 164.0, 26.10, 0.00, 6.32, 0.00, 0.00, 72.0, 2.070, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Beef Steak Sirloin', 'protein', 'raw', '174036', 'per_100g', 100.0, 143.0, 22.00, 0.00, 5.43, 0.00, 0.00, 55.0, 1.750, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
      ('Beef Steak Sirloin', 'protein', 'grilled', '174044', 'per_100g', 100.0, 177.0, 30.83, 0.00, 5.45, 0.00, 0.00, 58.0, 2.440, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
      ('Cottage Cheese Low Fat', 'protein', 'as_is', '173417', 'per_100g', 100.0, 72.0, 12.39, 2.72, 1.02, 0.00, 2.72, 406.0, 1.120, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Greek Yogurt Plain Low Fat', 'protein', 'as_is', '330137', 'per_100g', 100.0, 59.0, 10.19, 3.60, 0.39, 0.00, 3.24, 36.0, 0.870, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Whey Protein Powder', 'protein', 'as_is', '173180', 'per_100g', 100.0, 352.0, 78.10, 5.60, 1.50, 0.00, 3.20, 469.0, 8.600, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Casein Protein Powder', 'protein', 'as_is', NULL, 'per_100g', 100.0, 370.0, 80.00, 3.00, 1.50, 0.00, 1.00, 250.0, 7.200, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('White Rice', 'carb', 'raw', '168877', 'per_100g', 100.0, 365.0, 7.13, 79.95, 0.66, 1.30, 0.12, 5.0, 0.587, 73, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('White Rice', 'carb', 'cooked', '168878', 'per_100g', 100.0, 130.0, 2.69, 28.17, 0.28, 0.40, 0.05, 1.0, 0.222, 73, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Brown Rice', 'carb', 'raw', '168858', 'per_100g', 100.0, 370.0, 7.94, 77.24, 2.92, 3.50, 0.85, 7.0, 0.657, 68, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Brown Rice', 'carb', 'cooked', '168875', 'per_100g', 100.0, 112.0, 2.32, 23.51, 0.83, 1.80, 0.00, 1.0, 0.191, 68, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Oats Rolled', 'carb', 'raw', '169705', 'per_100g', 100.0, 389.0, 16.89, 66.27, 6.90, 10.60, 0.00, 2.0, 1.284, 55, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Oats Rolled', 'carb', 'cooked', '168868', 'per_100g', 100.0, 71.0, 2.54, 12.00, 1.52, 1.70, 0.27, 4.0, 0.165, 55, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('White Potato', 'carb', 'raw', '170026', 'per_100g', 100.0, 77.0, 2.05, 17.49, 0.09, 2.10, 0.82, 6.0, 0.095, NULL, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('White Potato', 'carb', 'boiled', '170440', 'per_100g', 100.0, 86.0, 1.71, 20.01, 0.10, 1.40, 0.85, 5.0, 0.078, 78, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('White Potato', 'carb', 'baked', '170093', 'per_100g', 100.0, 93.0, 2.50, 21.15, 0.13, 2.20, 1.18, 10.0, 0.116, 85, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('White Potato', 'carb', 'mashed', '168555', 'per_100g', 100.0, 113.0, 1.86, 16.81, 4.22, 1.50, 1.26, 317.0, 0.086, 83, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
      ('Sweet Potato', 'carb', 'raw', '168482', 'per_100g', 100.0, 86.0, 1.57, 20.12, 0.05, 3.00, 4.18, 55.0, 0.039, 63, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Sweet Potato', 'carb', 'boiled', '168484', 'per_100g', 100.0, 76.0, 1.37, 17.72, 0.14, 2.50, 5.74, 27.0, 0.034, 63, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Sweet Potato', 'carb', 'baked', '168483', 'per_100g', 100.0, 90.0, 2.01, 20.71, 0.15, 3.30, 6.48, 36.0, 0.050, 70, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Sweet Potato', 'carb', 'mashed', '169305', 'per_100g', 100.0, 80.0, 1.65, 20.42, 0.11, 2.50, 4.72, 21.0, 0.040, 63, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Pasta White', 'carb', 'raw', '168927', 'per_100g', 100.0, 371.0, 13.04, 74.67, 1.51, 3.20, 2.67, 6.0, 0.934, 49, 'raw', ARRAY['vegan','dairy_free','halal']),
      ('Pasta White', 'carb', 'cooked', '168928', 'per_100g', 100.0, 158.0, 5.80, 30.86, 0.93, 1.80, 0.56, 1.0, 0.473, 49, 'cooked', ARRAY['vegan','dairy_free','halal']),
      ('Pasta Wholegrain', 'carb', 'raw', '169738', 'per_100g', 100.0, 348.0, 14.63, 73.36, 2.93, 8.60, 2.88, 5.0, 0.972, 42, 'raw', ARRAY['vegan','dairy_free','halal']),
      ('Pasta Wholegrain', 'carb', 'cooked', '168910', 'per_100g', 100.0, 124.0, 5.33, 26.54, 0.54, 3.90, 0.56, 3.0, 0.370, 42, 'cooked', ARRAY['vegan','dairy_free','halal']),
      ('Bread White', 'carb', 'as_is', '174924', 'per_100g', 100.0, 266.0, 8.85, 49.20, 3.59, 2.30, 5.33, 450.0, 0.580, 75, 'as_is', ARRAY['vegan','dairy_free','halal']),
      ('Bread Wholegrain', 'carb', 'as_is', '174838', 'per_100g', 100.0, 252.0, 12.30, 43.08, 3.55, 6.00, 4.42, 430.0, 0.800, 54, 'as_is', ARRAY['vegan','dairy_free','halal']),
      ('Quinoa', 'carb', 'raw', '168874', 'per_100g', 100.0, 368.0, 14.12, 64.16, 6.07, 7.00, 1.50, 5.0, 0.840, 53, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Quinoa', 'carb', 'cooked', '168917', 'per_100g', 100.0, 120.0, 4.40, 21.30, 1.92, 2.80, 0.87, 7.0, 0.261, 53, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Banana', 'carb', 'raw', '173944', 'per_100g', 100.0, 89.0, 1.09, 22.84, 0.33, 2.60, 12.23, 1.0, 0.068, 51, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Apple', 'carb', 'raw', '171688', 'per_100g', 100.0, 52.0, 0.26, 13.81, 0.17, 2.40, 10.39, 1.0, 0.013, 36, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Orange', 'carb', 'raw', '169097', 'per_100g', 100.0, 47.0, 0.94, 11.75, 0.12, 2.40, 9.35, 0.0, 0.023, 43, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Blueberries', 'carb', 'raw', '171711', 'per_100g', 100.0, 57.0, 0.74, 14.49, 0.33, 2.40, 9.96, 1.0, 0.013, 53, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Strawberries', 'carb', 'raw', '167762', 'per_100g', 100.0, 32.0, 0.67, 7.68, 0.30, 2.00, 4.89, 1.0, 0.025, 40, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Olive Oil Extra Virgin', 'fat', 'as_is', '171413', 'per_100g', 100.0, 884.0, 0.00, 0.00, 100.00, 0.00, 0.00, 2.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Olive Oil Spray', 'fat', 'as_is', NULL, 'per_piece', 0.25, 2.0, 0.00, 0.00, 0.25, 0.00, 0.00, 0.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Coconut Oil', 'fat', 'as_is', '171412', 'per_100g', 100.0, 862.0, 0.00, 0.00, 100.00, 0.00, 0.00, 0.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Butter Unsalted', 'fat', 'as_is', '173430', 'per_100g', 100.0, 717.0, 0.85, 0.06, 81.11, 0.00, 0.06, 11.0, 0.086, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Butter Salted', 'fat', 'as_is', '173410', 'per_100g', 100.0, 717.0, 0.85, 0.06, 81.11, 0.00, 0.06, 643.0, 0.086, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Avocado', 'fat', 'raw', '171705', 'per_100g', 100.0, 160.0, 2.00, 8.53, 14.66, 6.70, 0.66, 7.0, 0.143, 15, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Almonds', 'fat', 'raw', '170567', 'per_100g', 100.0, 579.0, 21.15, 21.55, 49.93, 12.50, 4.35, 1.0, 1.488, 15, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Peanut Butter Natural', 'fat', 'as_is', '174294', 'per_100g', 100.0, 588.0, 22.21, 24.06, 49.94, 5.70, 6.56, 476.0, 1.528, 14, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Cashews', 'fat', 'raw', '170162', 'per_100g', 100.0, 553.0, 18.22, 30.19, 43.85, 3.30, 5.91, 12.0, 1.493, 22, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Walnuts', 'fat', 'raw', '170187', 'per_100g', 100.0, 654.0, 15.23, 13.71, 65.21, 6.70, 2.61, 2.0, 1.170, 15, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Broccoli', 'vegetable', 'raw', '170379', 'per_100g', 100.0, 34.0, 2.82, 6.64, 0.37, 2.60, 1.70, 33.0, 0.021, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Broccoli', 'vegetable', 'steamed', '169967', 'per_100g', 100.0, 35.0, 2.38, 7.18, 0.41, 3.30, 1.39, 41.0, 0.019, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Broccoli', 'vegetable', 'boiled', '169967', 'per_100g', 100.0, 35.0, 2.38, 7.18, 0.41, 3.30, 1.39, 41.0, 0.019, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Spinach', 'vegetable', 'raw', '168462', 'per_100g', 100.0, 23.0, 2.86, 3.63, 0.39, 2.20, 0.42, 79.0, 0.028, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Spinach', 'vegetable', 'cooked', '168463', 'per_100g', 100.0, 23.0, 2.97, 3.75, 0.26, 2.40, 0.49, 70.0, 0.029, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Lettuce Romaine', 'vegetable', 'raw', '169247', 'per_100g', 100.0, 17.0, 1.23, 3.29, 0.30, 2.10, 1.19, 8.0, 0.010, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Cucumber', 'vegetable', 'raw', '170383', 'per_100g', 100.0, 15.0, 0.65, 3.63, 0.11, 0.50, 1.67, 2.0, 0.006, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Tomato', 'vegetable', 'raw', '170457', 'per_100g', 100.0, 18.0, 0.88, 3.89, 0.20, 1.20, 2.63, 5.0, 0.007, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Bell Pepper Red', 'vegetable', 'raw', '170108', 'per_100g', 100.0, 26.0, 0.99, 6.03, 0.30, 2.10, 4.20, 4.0, 0.008, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Bell Pepper Green', 'vegetable', 'raw', '168448', 'per_100g', 100.0, 20.0, 0.86, 4.64, 0.17, 1.70, 2.40, 3.0, 0.007, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Onion', 'vegetable', 'raw', '170000', 'per_100g', 100.0, 40.0, 1.10, 9.34, 0.10, 1.70, 4.24, 4.0, 0.009, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Onion', 'vegetable', 'cooked', '170001', 'per_100g', 100.0, 44.0, 1.36, 10.15, 0.19, 1.40, 4.73, 3.0, 0.010, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Garlic', 'vegetable', 'raw', '169230', 'per_100g', 100.0, 149.0, 6.36, 33.06, 0.50, 2.10, 1.00, 17.0, 0.049, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Mushrooms White', 'vegetable', 'raw', '169251', 'per_100g', 100.0, 22.0, 3.09, 3.26, 0.34, 1.00, 1.98, 5.0, 0.024, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Mushrooms White', 'vegetable', 'cooked', '169252', 'per_100g', 100.0, 28.0, 2.17, 5.29, 0.47, 2.20, 2.33, 2.0, 0.017, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Zucchini', 'vegetable', 'raw', '169291', 'per_100g', 100.0, 17.0, 1.21, 3.11, 0.32, 1.00, 2.50, 8.0, 0.009, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Carrot', 'vegetable', 'raw', '170393', 'per_100g', 100.0, 41.0, 0.93, 9.58, 0.24, 2.80, 4.74, 69.0, 0.007, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Carrot', 'vegetable', 'boiled', '170394', 'per_100g', 100.0, 35.0, 0.76, 8.22, 0.18, 3.00, 3.45, 58.0, 0.006, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Celery', 'vegetable', 'raw', '169988', 'per_100g', 100.0, 14.0, 0.69, 2.97, 0.17, 1.60, 1.34, 80.0, 0.006, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Green Beans', 'vegetable', 'raw', '169961', 'per_100g', 100.0, 31.0, 1.83, 6.97, 0.22, 2.70, 3.26, 6.0, 0.015, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Green Beans', 'vegetable', 'boiled', '169962', 'per_100g', 100.0, 35.0, 1.89, 7.88, 0.28, 3.20, 1.54, 1.0, 0.015, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Asparagus', 'vegetable', 'raw', '168389', 'per_100g', 100.0, 20.0, 2.20, 3.88, 0.12, 2.10, 1.88, 2.0, 0.018, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Asparagus', 'vegetable', 'grilled', '168390', 'per_100g', 100.0, 22.0, 2.40, 4.11, 0.22, 2.00, 1.30, 14.0, 0.019, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Cauliflower', 'vegetable', 'raw', '169986', 'per_100g', 100.0, 25.0, 1.92, 4.97, 0.28, 2.00, 1.91, 30.0, 0.015, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Cauliflower', 'vegetable', 'steamed', '169989', 'per_100g', 100.0, 23.0, 1.84, 4.11, 0.45, 2.30, 1.60, 15.0, 0.015, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Kale', 'vegetable', 'raw', '168421', 'per_100g', 100.0, 49.0, 4.28, 8.75, 0.93, 3.60, 2.26, 38.0, 0.033, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Arugula Rocket', 'vegetable', 'raw', '170068', 'per_100g', 100.0, 25.0, 2.58, 3.65, 0.66, 1.60, 2.05, 27.0, 0.020, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Radish', 'vegetable', 'raw', '169276', 'per_100g', 100.0, 16.0, 0.68, 3.40, 0.10, 1.60, 1.86, 39.0, 0.006, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Milk Whole', 'dairy', 'as_is', '171265', 'per_100g', 100.0, 61.0, 3.15, 4.78, 3.27, 0.00, 4.81, 43.0, 0.294, 31, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Milk Skimmed', 'dairy', 'as_is', '171269', 'per_100g', 100.0, 34.0, 3.44, 4.92, 0.08, 0.00, 4.92, 41.0, 0.330, 32, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Almond Milk Unsweetened', 'dairy', 'as_is', '174832', 'per_100g', 100.0, 15.0, 0.55, 0.34, 1.22, 0.00, 0.00, 60.0, 0.004, 25, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Oat Milk', 'dairy', 'as_is', '719016', 'per_100g', 100.0, 50.0, 1.00, 6.70, 2.10, 0.80, 2.90, 42.0, 0.008, 69, 'as_is', ARRAY['vegan','halal','dairy_free']),
      ('Cheddar Cheese', 'dairy', 'as_is', '173414', 'per_100g', 100.0, 403.0, 22.87, 3.37, 33.31, 0.00, 0.48, 653.0, 2.149, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Mozzarella Low Fat', 'dairy', 'as_is', '171244', 'per_100g', 100.0, 295.0, 23.77, 5.58, 19.85, 0.00, 1.50, 528.0, 2.131, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Cheese Slice Reduced Fat', 'dairy', 'as_is', '172189', 'per_100g', 100.0, 240.0, 18.00, 11.00, 14.00, 0.00, 8.00, 1201.0, 1.620, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
      ('Soy Sauce Low Sodium', 'condiment', 'as_is', '174278', 'per_100g', 100.0, 73.0, 5.13, 10.35, 0.08, 0.80, 1.70, 3333.0, 0.000, 0, 'as_is', ARRAY['vegan','dairy_free']),
      ('Hot Sauce', 'condiment', 'as_is', '171909', 'per_100g', 100.0, 11.0, 0.51, 1.75, 0.44, 0.30, 0.87, 2643.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Tomato Paste', 'condiment', 'as_is', '170459', 'per_100g', 100.0, 82.0, 4.32, 18.91, 0.47, 4.10, 12.18, 32.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Lemon Juice', 'condiment', 'raw', '167747', 'per_100g', 100.0, 22.0, 0.35, 6.90, 0.24, 0.30, 2.52, 1.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Apple Cider Vinegar', 'condiment', 'as_is', '173469', 'per_100g', 100.0, 21.0, 0.00, 0.93, 0.00, 0.00, 0.40, 5.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Honey', 'condiment', 'as_is', '169640', 'per_100g', 100.0, 304.0, 0.30, 82.40, 0.00, 0.20, 82.12, 4.0, 0.000, 61, 'as_is', ARRAY['vegetarian','gluten_free','halal','dairy_free']),
      ('Salt', 'condiment', 'as_is', '173530', 'per_100g', 100.0, 0.0, 0.00, 0.00, 0.00, 0.00, 0.00, 38758.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Cinnamon Ground', 'condiment', 'as_is', '171320', 'per_100g', 100.0, 247.0, 3.99, 80.59, 1.24, 53.10, 2.17, 10.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Black Pepper Ground', 'condiment', 'as_is', '170931', 'per_100g', 100.0, 251.0, 10.39, 63.95, 3.26, 25.30, 0.64, 20.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
      ('Stevia Pure', 'condiment', 'as_is', NULL, 'per_100g', 100.0, 0.0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'])
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

  // ── Custom Goal Mode columns ─────────────────────────────────────────────────
  await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_custom_goal BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS custom_protein_rate REAL`);
  await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS custom_fat_rate REAL`);
  await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS custom_deficit_kcal INTEGER`);

  // ── Weight History ────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weight_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      weight_kg REAL NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_weight_history_user ON weight_history(user_id, recorded_at)`);

  // Seed weight_history from the earliest plan snapshot for users who have no history yet
  await pool.query(`
    INSERT INTO weight_history (user_id, weight_kg, recorded_at)
    SELECT DISTINCT ON (p.user_id) p.user_id, p.snapshot_weight_kg, p.created_at
    FROM plans p
    WHERE p.snapshot_weight_kg IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM weight_history wh WHERE wh.user_id = p.user_id)
    ORDER BY p.user_id, p.created_at ASC
  `);

  // ── Password Reset Tokens ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id)`);

  // ── Role System ──────────────────────────────────────────────────────────────
  // coach_id: which coach is assigned to this user (member)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_coach_id ON users(coach_id)`);

  // coach_updated_at: set when a coach modifies the client's plan
  await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS coach_updated_at TIMESTAMPTZ`);

  // Ensure role column exists with correct default
  await pool.query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'member'`);

  // ── Coach Services ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_services (
      id SERIAL PRIMARY KEY,
      coach_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10, 3),
      specializations TEXT[] NOT NULL DEFAULT '{}',
      active_offer TEXT,
      before_after_photos TEXT[] NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_coach_services_coach ON coach_services(coach_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_coach_services_active ON coach_services(is_active)`);
}
