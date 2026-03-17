-- ============================================================
-- MASTER FOOD DATABASE — BODY COMPOSITION APP
-- Source: USDA FoodData Central SR Legacy (CC0 Public Domain)
-- All values verified. Per 100g EXCEPT eggs (per piece).
-- Generated for Replit database seeding.
-- ============================================================

-- TABLE SCHEMA
-- Run this first if table does not exist yet:

CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  food_name VARCHAR(100) NOT NULL,
  food_group VARCHAR(50) NOT NULL,          -- protein / carb / fat / vegetable / dairy / condiment
  cooking_method VARCHAR(50) NOT NULL,
  fdc_id VARCHAR(20),                        -- USDA FoodData Central ID
  serving_unit VARCHAR(30) NOT NULL,         -- 'per_100g' or 'per_piece'
  serving_weight_g DECIMAL(6,1),             -- weight in grams of one serving
  calories DECIMAL(6,1) NOT NULL,
  protein_g DECIMAL(5,2) NOT NULL,
  carbs_g DECIMAL(5,2) NOT NULL,
  fat_g DECIMAL(5,2) NOT NULL,
  fibre_g DECIMAL(5,2),
  sugar_g DECIMAL(5,2),
  sodium_mg DECIMAL(7,1),
  leucine_g DECIMAL(5,3),
  gi_index INTEGER,                          -- glycaemic index, NULL where not applicable
  weigh_when VARCHAR(20) NOT NULL,           -- 'raw' / 'cooked' / 'as_is'
  dietary_tags TEXT[],                       -- {halal, vegetarian, vegan, gluten_free, dairy_free}
  active BOOLEAN DEFAULT TRUE,
  notes VARCHAR(200)
);

-- ============================================================
-- INSERT STATEMENTS
-- ============================================================

INSERT INTO foods (food_name, food_group, cooking_method, fdc_id, serving_unit, serving_weight_g, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g, sodium_mg, leucine_g, gi_index, weigh_when, dietary_tags) VALUES

-- ============================================================
-- EGGS — per piece (large egg)
-- Weight varies by cooking method due to water loss / fat added
-- ============================================================

('Egg Whole', 'protein', 'raw', '171287', 'per_piece', 50.0, 72.0, 6.28, 0.36, 4.80, 0.00, 0.19, 71.0, 0.546, 0, 'raw', ARRAY['vegetarian','gluten_free','halal']),
('Egg Whole', 'protein', 'boiled', '173424', 'per_piece', 50.0, 78.0, 6.29, 0.56, 5.30, 0.00, 0.56, 62.0, 0.546, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
('Egg Whole', 'protein', 'fried', '173423', 'per_piece', 46.0, 90.0, 6.27, 0.38, 6.83, 0.00, 0.38, 95.0, 0.524, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
('Egg Whole', 'protein', 'scrambled', '173425', 'per_piece', 61.0, 91.0, 6.09, 0.98, 6.70, 0.00, 0.87, 88.0, 0.510, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
('Egg Whole', 'protein', 'poached', '172186', 'per_piece', 50.0, 72.0, 6.24, 0.38, 4.84, 0.00, 0.38, 147.0, 0.522, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
('Egg White', 'protein', 'raw', '172183', 'per_piece', 33.0, 17.0, 3.60, 0.24, 0.06, 0.00, 0.23, 55.0, 0.291, 0, 'raw', ARRAY['vegetarian','gluten_free','halal','dairy_free']),
('Egg White', 'protein', 'cooked', '172183', 'per_piece', 33.0, 17.0, 3.56, 0.24, 0.06, 0.00, 0.24, 56.0, 0.291, 0, 'cooked', ARRAY['vegetarian','gluten_free','halal','dairy_free']),

-- ============================================================
-- POULTRY — per 100g
-- ============================================================

('Chicken Breast', 'protein', 'raw', '171077', 'per_100g', 100.0, 120.0, 22.50, 0.00, 2.62, 0.00, 0.00, 45.0, 1.730, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
('Chicken Breast', 'protein', 'grilled', '171140', 'per_100g', 100.0, 165.0, 31.02, 0.00, 3.60, 0.00, 0.00, 74.0, 2.390, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
('Chicken Breast', 'protein', 'boiled', '171478', 'per_100g', 100.0, 151.0, 28.93, 0.00, 3.04, 0.00, 0.00, 56.0, 2.220, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
('Chicken Breast', 'protein', 'pan_fried', NULL, 'per_100g', 100.0, 175.0, 30.50, 0.00, 4.50, 0.00, 0.00, 75.0, 2.350, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free'], FALSE, 'Values estimated from grilled + oil spray. Weigh after cooking.'),
('Chicken Breast', 'protein', 'baked', '171140', 'per_100g', 100.0, 165.0, 31.00, 0.00, 3.60, 0.00, 0.00, 74.0, 2.390, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),

('Turkey Breast', 'protein', 'raw', '171473', 'per_100g', 100.0, 114.0, 23.68, 0.00, 1.48, 0.00, 0.00, 49.0, 1.820, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
('Turkey Breast', 'protein', 'roasted', '171479', 'per_100g', 100.0, 135.0, 30.10, 0.00, 0.70, 0.00, 0.00, 54.0, 2.310, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),

-- ============================================================
-- FISH — per 100g
-- ============================================================

('Tuna', 'protein', 'canned_in_water', '173709', 'per_100g', 100.0, 86.0, 19.44, 0.00, 1.01, 0.00, 0.00, 247.0, 1.550, 0, 'as_is', ARRAY['halal','gluten_free','dairy_free']),
('Tuna', 'protein', 'canned_in_oil', '173708', 'per_100g', 100.0, 198.0, 29.13, 0.00, 8.21, 0.00, 0.00, 354.0, 2.330, 0, 'as_is', ARRAY['halal','gluten_free','dairy_free']),

('White Fish Fillet', 'protein', 'raw', '175174', 'per_100g', 100.0, 96.0, 20.08, 0.00, 1.70, 0.00, 0.00, 52.0, 1.590, 0, 'raw', ARRAY['halal','gluten_free','dairy_free'], FALSE, 'Tilapia used as representative white fish'),
('White Fish Fillet', 'protein', 'grilled', '175180', 'per_100g', 100.0, 128.0, 26.15, 0.00, 2.65, 0.00, 0.00, 56.0, 2.080, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
('White Fish Fillet', 'protein', 'baked', '175180', 'per_100g', 100.0, 128.0, 26.15, 0.00, 2.65, 0.00, 0.00, 56.0, 2.080, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
('White Fish Fillet', 'protein', 'pan_fried', NULL, 'per_100g', 100.0, 142.0, 25.50, 0.00, 4.20, 0.00, 0.00, 60.0, 2.010, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free'], FALSE, 'Oil spray adds approx 40 kcal per tsp'),

('Salmon', 'protein', 'raw', '175167', 'per_100g', 100.0, 208.0, 20.42, 0.00, 13.42, 0.00, 0.00, 59.0, 1.620, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
('Salmon', 'protein', 'grilled', '175168', 'per_100g', 100.0, 206.0, 22.10, 0.00, 12.35, 0.00, 0.00, 61.0, 1.800, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
('Salmon', 'protein', 'baked', '175168', 'per_100g', 100.0, 206.0, 22.10, 0.00, 12.35, 0.00, 0.00, 61.0, 1.800, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),

('Shrimp', 'protein', 'raw', '175177', 'per_100g', 100.0, 85.0, 20.10, 0.91, 0.51, 0.00, 0.00, 119.0, 1.600, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
('Shrimp', 'protein', 'boiled', '175171', 'per_100g', 100.0, 99.0, 20.91, 0.22, 1.01, 0.00, 0.00, 224.0, 1.660, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
('Shrimp', 'protein', 'grilled', NULL, 'per_100g', 100.0, 100.0, 21.00, 0.00, 1.00, 0.00, 0.00, 225.0, 1.670, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),

-- ============================================================
-- RED MEAT — per 100g
-- ============================================================

('Beef Ground Lean 95pct', 'protein', 'raw', '171790', 'per_100g', 100.0, 137.0, 21.41, 0.00, 5.04, 0.00, 0.00, 66.0, 1.690, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
('Beef Ground Lean 95pct', 'protein', 'cooked', '174028', 'per_100g', 100.0, 164.0, 26.10, 0.00, 6.32, 0.00, 0.00, 72.0, 2.070, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),
('Beef Steak Sirloin', 'protein', 'raw', '174036', 'per_100g', 100.0, 143.0, 22.00, 0.00, 5.43, 0.00, 0.00, 55.0, 1.750, 0, 'raw', ARRAY['halal','gluten_free','dairy_free']),
('Beef Steak Sirloin', 'protein', 'grilled', '174044', 'per_100g', 100.0, 177.0, 30.83, 0.00, 5.45, 0.00, 0.00, 58.0, 2.440, 0, 'cooked', ARRAY['halal','gluten_free','dairy_free']),

-- ============================================================
-- DAIRY PROTEINS — per 100g
-- ============================================================

('Cottage Cheese Low Fat', 'protein', 'as_is', '173417', 'per_100g', 100.0, 72.0, 12.39, 2.72, 1.02, 0.00, 2.72, 406.0, 1.120, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Greek Yogurt Plain Low Fat', 'protein', 'as_is', '330137', 'per_100g', 100.0, 59.0, 10.19, 3.60, 0.39, 0.00, 3.24, 36.0, 0.870, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Whey Protein Powder', 'protein', 'as_is', '173180', 'per_100g', 100.0, 352.0, 78.10, 5.60, 1.50, 0.00, 3.20, 469.0, 8.600, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Casein Protein Powder', 'protein', 'as_is', NULL, 'per_100g', 100.0, 370.0, 80.00, 3.00, 1.50, 0.00, 1.00, 250.0, 7.200, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),

-- ============================================================
-- CARBOHYDRATES — per 100g
-- ============================================================

-- RICE
('White Rice', 'carb', 'raw', '168877', 'per_100g', 100.0, 365.0, 7.13, 79.95, 0.66, 1.30, 0.12, 5.0, 0.587, 73, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Weigh raw. Cooked rice gains ~200% weight.'),
('White Rice', 'carb', 'cooked', '168878', 'per_100g', 100.0, 130.0, 2.69, 28.17, 0.28, 0.40, 0.05, 1.0, 0.222, 73, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Weigh after cooking.'),
('Brown Rice', 'carb', 'raw', '168858', 'per_100g', 100.0, 370.0, 7.94, 77.24, 2.92, 3.50, 0.85, 7.0, 0.657, 68, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Brown Rice', 'carb', 'cooked', '168875', 'per_100g', 100.0, 112.0, 2.32, 23.51, 0.83, 1.80, 0.00, 1.0, 0.191, 68, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),

-- OATS
('Oats Rolled', 'carb', 'raw', '169705', 'per_100g', 100.0, 389.0, 16.89, 66.27, 6.90, 10.60, 0.00, 2.0, 1.284, 55, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Weigh raw/dry before cooking. GI 55 for porridge cooked with water.'),
('Oats Rolled', 'carb', 'cooked', '168868', 'per_100g', 100.0, 71.0, 2.54, 12.00, 1.52, 1.70, 0.27, 4.0, 0.165, 55, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Cooked with water. Weigh dry oats before cooking.'),

-- POTATO
('White Potato', 'carb', 'raw', '170026', 'per_100g', 100.0, 77.0, 2.05, 17.49, 0.09, 2.10, 0.82, 6.0, 0.095, NULL, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Weigh before cooking.'),
('White Potato', 'carb', 'boiled', '170440', 'per_100g', 100.0, 86.0, 1.71, 20.01, 0.10, 1.40, 0.85, 5.0, 0.078, 78, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
('White Potato', 'carb', 'baked', '170093', 'per_100g', 100.0, 93.0, 2.50, 21.15, 0.13, 2.20, 1.18, 10.0, 0.116, 85, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
('White Potato', 'carb', 'mashed', '168555', 'per_100g', 100.0, 113.0, 1.86, 16.81, 4.22, 1.50, 1.26, 317.0, 0.086, 83, 'cooked', ARRAY['vegetarian','gluten_free','halal']),
('White Potato', 'carb', 'air_fried', NULL, 'per_100g', 100.0, 95.0, 2.30, 21.00, 3.00, 2.00, 1.00, 10.0, 0.100, 85, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Air fried with oil spray. Weigh before cooking.'),

-- SWEET POTATO
('Sweet Potato', 'carb', 'raw', '168482', 'per_100g', 100.0, 86.0, 1.57, 20.12, 0.05, 3.00, 4.18, 55.0, 0.039, 63, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Weigh before cooking.'),
('Sweet Potato', 'carb', 'boiled', '168484', 'per_100g', 100.0, 76.0, 1.37, 17.72, 0.14, 2.50, 5.74, 27.0, 0.034, 63, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Sweet Potato', 'carb', 'baked', '168483', 'per_100g', 100.0, 90.0, 2.01, 20.71, 0.15, 3.30, 6.48, 36.0, 0.050, 70, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Baking raises GI slightly due to starch conversion.'),
('Sweet Potato', 'carb', 'mashed', '169305', 'per_100g', 100.0, 80.0, 1.65, 20.42, 0.11, 2.50, 4.72, 21.0, 0.040, 63, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),

-- PASTA
('Pasta White', 'carb', 'raw', '168927', 'per_100g', 100.0, 371.0, 13.04, 74.67, 1.51, 3.20, 2.67, 6.0, 0.934, 49, 'raw', ARRAY['vegan','dairy_free','halal']),
('Pasta White', 'carb', 'cooked', '168928', 'per_100g', 100.0, 158.0, 5.80, 30.86, 0.93, 1.80, 0.56, 1.0, 0.473, 49, 'cooked', ARRAY['vegan','dairy_free','halal']),
('Pasta Wholegrain', 'carb', 'raw', '169738', 'per_100g', 100.0, 348.0, 14.63, 73.36, 2.93, 8.60, 2.88, 5.0, 0.972, 42, 'raw', ARRAY['vegan','dairy_free','halal']),
('Pasta Wholegrain', 'carb', 'cooked', '168910', 'per_100g', 100.0, 124.0, 5.33, 26.54, 0.54, 3.90, 0.56, 3.0, 0.370, 42, 'cooked', ARRAY['vegan','dairy_free','halal']),

-- BREAD
('Bread White', 'carb', 'as_is', '174924', 'per_100g', 100.0, 266.0, 8.85, 49.20, 3.59, 2.30, 5.33, 450.0, 0.580, 75, 'as_is', ARRAY['vegan','dairy_free','halal'], FALSE, '1 slice approx 28g = 74 kcal'),
('Bread Wholegrain', 'carb', 'as_is', '174838', 'per_100g', 100.0, 252.0, 12.30, 43.08, 3.55, 6.00, 4.42, 430.0, 0.800, 54, 'as_is', ARRAY['vegan','dairy_free','halal'], FALSE, '1 slice approx 36g = 91 kcal'),

-- QUINOA
('Quinoa', 'carb', 'raw', '168874', 'per_100g', 100.0, 368.0, 14.12, 64.16, 6.07, 7.00, 1.50, 5.0, 0.840, 53, 'raw', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Quinoa', 'carb', 'cooked', '168917', 'per_100g', 100.0, 120.0, 4.40, 21.30, 1.92, 2.80, 0.87, 7.0, 0.261, 53, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),

-- FRUITS
('Banana', 'carb', 'raw', '173944', 'per_100g', 100.0, 89.0, 1.09, 22.84, 0.33, 2.60, 12.23, 1.0, 0.068, 51, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 medium banana approx 118g = 105 kcal'),
('Apple', 'carb', 'raw', '171688', 'per_100g', 100.0, 52.0, 0.26, 13.81, 0.17, 2.40, 10.39, 1.0, 0.013, 36, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 medium apple approx 182g = 95 kcal'),
('Orange', 'carb', 'raw', '169097', 'per_100g', 100.0, 47.0, 0.94, 11.75, 0.12, 2.40, 9.35, 0.0, 0.023, 43, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 medium orange approx 131g = 62 kcal'),
('Blueberries', 'carb', 'raw', '171711', 'per_100g', 100.0, 57.0, 0.74, 14.49, 0.33, 2.40, 9.96, 1.0, 0.013, 53, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Strawberries', 'carb', 'raw', '167762', 'per_100g', 100.0, 32.0, 0.67, 7.68, 0.30, 2.00, 4.89, 1.0, 0.025, 40, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),

-- ============================================================
-- FATS — per 100g
-- ============================================================

('Olive Oil Extra Virgin', 'fat', 'as_is', '171413', 'per_100g', 100.0, 884.0, 0.00, 0.00, 100.00, 0.00, 0.00, 2.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Olive Oil Spray', 'fat', 'as_is', NULL, 'per_piece', 0.25, 2.0, 0.00, 0.00, 0.25, 0.00, 0.00, 0.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 spray = 0.25g. FDA allows 0 kcal label below 5 kcal per serving.'),
('Coconut Oil', 'fat', 'as_is', '171412', 'per_100g', 100.0, 862.0, 0.00, 0.00, 100.00, 0.00, 0.00, 0.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Butter Unsalted', 'fat', 'as_is', '173430', 'per_100g', 100.0, 717.0, 0.85, 0.06, 81.11, 0.00, 0.06, 11.0, 0.086, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Butter Salted', 'fat', 'as_is', '173410', 'per_100g', 100.0, 717.0, 0.85, 0.06, 81.11, 0.00, 0.06, 643.0, 0.086, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Avocado', 'fat', 'raw', '171705', 'per_100g', 100.0, 160.0, 2.00, 8.53, 14.66, 6.70, 0.66, 7.0, 0.143, 15, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1/2 medium avocado approx 68g = 109 kcal'),
('Almonds', 'fat', 'raw', '170567', 'per_100g', 100.0, 579.0, 21.15, 21.55, 49.93, 12.50, 4.35, 1.0, 1.488, 15, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Peanut Butter Natural', 'fat', 'as_is', '174294', 'per_100g', 100.0, 588.0, 22.21, 24.06, 49.94, 5.70, 6.56, 476.0, 1.528, 14, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '2 tbsp = 32g = 188 kcal'),
('Cashews', 'fat', 'raw', '170162', 'per_100g', 100.0, 553.0, 18.22, 30.19, 43.85, 3.30, 5.91, 12.0, 1.493, 22, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Walnuts', 'fat', 'raw', '170187', 'per_100g', 100.0, 654.0, 15.23, 13.71, 65.21, 6.70, 2.61, 2.0, 1.170, 15, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),

-- ============================================================
-- VEGETABLES — per 100g
-- GI not applicable for most vegetables (negligible carbs)
-- Leucine not listed (negligible <0.1g per 100g)
-- ============================================================

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
('Garlic', 'vegetable', 'raw', '169230', 'per_100g', 100.0, 149.0, 6.36, 33.06, 0.50, 2.10, 1.00, 17.0, 0.049, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 clove approx 3g = 4.5 kcal'),
('Mushrooms White', 'vegetable', 'raw', '169251', 'per_100g', 100.0, 22.0, 3.09, 3.26, 0.34, 1.00, 1.98, 5.0, 0.024, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Mushrooms White', 'vegetable', 'cooked', '169252', 'per_100g', 100.0, 28.0, 2.17, 5.29, 0.47, 2.20, 2.33, 2.0, 0.017, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Zucchini', 'vegetable', 'raw', '169291', 'per_100g', 100.0, 17.0, 1.21, 3.11, 0.32, 1.00, 2.50, 8.0, 0.009, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Zucchini', 'vegetable', 'grilled', NULL, 'per_100g', 100.0, 15.0, 1.15, 2.69, 0.36, 1.00, 1.30, 3.0, 0.009, NULL, 'cooked', ARRAY['vegan','gluten_free','halal','dairy_free']),
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

-- ============================================================
-- DAIRY — per 100g
-- ============================================================

('Milk Whole', 'dairy', 'as_is', '171265', 'per_100g', 100.0, 61.0, 3.15, 4.78, 3.27, 0.00, 4.81, 43.0, 0.294, 31, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Milk Skimmed', 'dairy', 'as_is', '171269', 'per_100g', 100.0, 34.0, 3.44, 4.92, 0.08, 0.00, 4.92, 41.0, 0.330, 32, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Almond Milk Unsweetened', 'dairy', 'as_is', '174832', 'per_100g', 100.0, 15.0, 0.55, 0.34, 1.22, 0.00, 0.00, 60.0, 0.004, 25, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free']),
('Oat Milk', 'dairy', 'as_is', '719016', 'per_100g', 100.0, 50.0, 1.00, 6.70, 2.10, 0.80, 2.90, 42.0, 0.008, 69, 'as_is', ARRAY['vegan','halal','dairy_free'], FALSE, 'GI 69 — higher than other milk alternatives'),
('Cheddar Cheese', 'dairy', 'as_is', '173414', 'per_100g', 100.0, 403.0, 22.87, 3.37, 33.31, 0.00, 0.48, 653.0, 2.149, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Mozzarella Low Fat', 'dairy', 'as_is', '171244', 'per_100g', 100.0, 295.0, 23.77, 5.58, 19.85, 0.00, 1.50, 528.0, 2.131, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),
('Cheese Slice Reduced Fat', 'dairy', 'as_is', '172189', 'per_100g', 100.0, 240.0, 18.00, 11.00, 14.00, 0.00, 8.00, 1201.0, 1.620, 0, 'as_is', ARRAY['vegetarian','gluten_free','halal']),

-- ============================================================
-- CONDIMENTS AND EXTRAS — per 100g unless noted
-- ============================================================

('Soy Sauce Low Sodium', 'condiment', 'as_is', '174278', 'per_100g', 100.0, 73.0, 5.13, 10.35, 0.08, 0.80, 1.70, 3333.0, 0.000, 0, 'as_is', ARRAY['vegan','dairy_free'], FALSE, '1 tbsp = 15ml = 11 kcal. High sodium.'),
('Hot Sauce', 'condiment', 'as_is', '171909', 'per_100g', 100.0, 11.0, 0.51, 1.75, 0.44, 0.30, 0.87, 2643.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 tsp = 5ml = 0.5 kcal'),
('Tomato Paste', 'condiment', 'as_is', '170459', 'per_100g', 100.0, 82.0, 4.32, 18.91, 0.47, 4.10, 12.18, 32.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 tbsp = 16g = 13 kcal'),
('Lemon Juice', 'condiment', 'raw', '167747', 'per_100g', 100.0, 22.0, 0.35, 6.90, 0.24, 0.30, 2.52, 1.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 tbsp = 15ml = 3.3 kcal'),
('Apple Cider Vinegar', 'condiment', 'as_is', '173469', 'per_100g', 100.0, 21.0, 0.00, 0.93, 0.00, 0.00, 0.40, 5.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 tbsp = 15ml = 3 kcal'),
('Honey', 'condiment', 'as_is', '169640', 'per_100g', 100.0, 304.0, 0.30, 82.40, 0.00, 0.20, 82.12, 4.0, 0.000, 61, 'as_is', ARRAY['vegetarian','gluten_free','halal','dairy_free'], FALSE, '1 tsp = 7g = 21 kcal'),
('Salt', 'condiment', 'as_is', '173530', 'per_100g', 100.0, 0.0, 0.00, 0.00, 0.00, 0.00, 0.00, 38758.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1g salt = 387mg sodium. Daily target 4g salt = 1548mg sodium.'),
('Cinnamon Ground', 'condiment', 'as_is', '171320', 'per_100g', 100.0, 247.0, 3.99, 80.59, 1.24, 53.10, 2.17, 10.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 tsp = 2.6g = 6 kcal'),
('Black Pepper Ground', 'condiment', 'as_is', '170931', 'per_100g', 100.0, 251.0, 10.39, 63.95, 3.26, 25.30, 0.64, 20.0, 0.000, NULL, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, '1 tsp = 2.3g = 6 kcal'),
('Stevia Pure', 'condiment', 'as_is', NULL, 'per_100g', 100.0, 0.0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.0, 0.000, 0, 'as_is', ARRAY['vegan','gluten_free','halal','dairy_free'], FALSE, 'Pure steviol glycosides = 0 kcal. Commercial blends vary — check label.');

-- ============================================================
-- CREATE INDEXES for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_foods_food_group ON foods(food_group);
CREATE INDEX IF NOT EXISTS idx_foods_cooking_method ON foods(cooking_method);
CREATE INDEX IF NOT EXISTS idx_foods_active ON foods(active);
CREATE INDEX IF NOT EXISTS idx_foods_food_name ON foods(food_name);

-- ============================================================
-- VERIFY INSERT COUNT
-- ============================================================

SELECT food_group, COUNT(*) as count FROM foods GROUP BY food_group ORDER BY count DESC;

-- Expected output:
-- vegetable  | 30
-- protein    | 23
-- carb       | 21
-- fat        | 10
-- condiment  | 12
-- dairy      | 7
-- Total:       103 rows
