import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middleware/role";

const router: IRouter = Router();

// ── User Management ──────────────────────────────────────────────────────────

router.get("/admin/users", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const result = await pool.query(`
    SELECT
      u.id, u.email, u.full_name, u.role, u.created_at, u.is_active,
      u.coach_id,
      c.full_name AS coach_name,
      up.goal_mode, up.weight_kg, up.target_weight_kg
    FROM users u
    LEFT JOIN users c ON c.id = u.coach_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    ORDER BY u.created_at DESC
  `);

  res.json(result.rows);
});

router.put("/admin/users/:id/role", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const targetId = parseInt(req.params["id"], 10);
  const { role } = req.body;

  if (!["member", "coach", "admin"].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be member, coach, or admin." });
    return;
  }

  if (targetId === adminId) {
    res.status(400).json({ error: "Cannot change your own role" });
    return;
  }

  await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, targetId]);

  // If demoting from coach, remove all their assigned clients
  if (role !== "coach") {
    await pool.query(`UPDATE users SET coach_id = NULL WHERE coach_id = $1`, [targetId]);
  }

  res.json({ message: "Role updated" });
});

router.post("/admin/users/:id/deactivate", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const targetId = parseInt(req.params["id"], 10);

  if (targetId === adminId) {
    res.status(400).json({ error: "Cannot deactivate your own account" });
    return;
  }

  await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [targetId]);

  // Destroy any active session for this user
  await pool.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [String(targetId)]).catch(() => {});

  res.json({ message: "User deactivated" });
});

router.post("/admin/users/:id/activate", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const targetId = parseInt(req.params["id"], 10);

  await pool.query(`UPDATE users SET is_active = true WHERE id = $1`, [targetId]);

  res.json({ message: "User activated" });
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const targetId = parseInt(req.params["id"], 10);

  if (targetId === adminId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Unlink any members who have this user as their coach
    await client.query(`UPDATE users SET coach_id = NULL WHERE coach_id = $1`, [targetId]);

    // Delete all related data in dependency order (leaf tables first)
    // Using DO blocks to safely skip tables that may not exist yet
    const safeDelete = (table: string, col: string) =>
      client.query(`DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name='${table}') THEN DELETE FROM ${table} WHERE ${col} = ${targetId}; END IF; END $$`);

    await safeDelete('meal_portion_completions', 'user_id');
    await safeDelete('meal_plan_completions', 'user_id');
    await safeDelete('meal_plan_exclusions', 'user_id');
    await safeDelete('meal_plan_entries', 'user_id');
    await safeDelete('meal_schedule', 'user_id');
    await safeDelete('meal_logs', 'user_id');
    await safeDelete('user_meals', 'user_id');
    await safeDelete('user_foods', 'user_id');
    await safeDelete('food_stock', 'user_id');
    await safeDelete('workout_exercise_completions', 'user_id');
    await safeDelete('workout_plan_completions', 'user_id');
    await safeDelete('workout_plan_exclusions', 'user_id');
    await safeDelete('workout_plan_entries', 'user_id');
    await safeDelete('workout_schedule', 'user_id');
    await safeDelete('workout_sessions', 'user_id');
    await safeDelete('user_workouts', 'user_id');
    await safeDelete('exercises', 'user_id');
    await safeDelete('weight_history', 'user_id');
    await safeDelete('weekly_checkins', 'user_id');
    await safeDelete('adjustment_logs', 'user_id');
    await safeDelete('plans', 'user_id');
    await safeDelete('user_profiles', 'user_id');
    await safeDelete('coach_services', 'coach_id');
    await safeDelete('coach_profiles', 'user_id');
    await safeDelete('password_reset_tokens', 'user_id');
    await client.query(`DELETE FROM session WHERE sess->>'userId' = $1`, [String(targetId)]).catch(() => {});

    // Finally delete the user
    await client.query(`DELETE FROM users WHERE id = $1`, [targetId]);

    await client.query("COMMIT");
    res.json({ message: "User deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  } finally {
    client.release();
  }
});

// ── Coach-Client Assignment ──────────────────────────────────────────────────

router.get("/admin/coaches", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const coaches = await pool.query(`
    SELECT u.id, u.email, u.full_name, u.role,
      COUNT(c.id)::int AS client_count,
      COALESCE(cs.price, 0)::numeric AS service_price,
      (COUNT(c.id) * COALESCE(cs.price, 0))::numeric AS estimated_revenue
    FROM users u
    LEFT JOIN users c ON c.coach_id = u.id AND c.role = 'member' AND c.is_active = true
    LEFT JOIN LATERAL (
      SELECT price FROM coach_services
      WHERE coach_id = u.id AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    ) cs ON true
    WHERE u.role = 'coach'
    GROUP BY u.id, cs.price
    ORDER BY u.full_name
  `);

  const coachIds = coaches.rows.map((r: { id: number }) => r.id);
  let clientsByCoach: Record<number, unknown[]> = {};

  if (coachIds.length > 0) {
    const clients = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.coach_id, up.goal_mode, up.weight_kg
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.coach_id = ANY($1::int[])
      ORDER BY u.full_name
    `, [coachIds]);

    for (const client of clients.rows) {
      if (!clientsByCoach[client.coach_id]) clientsByCoach[client.coach_id] = [];
      clientsByCoach[client.coach_id].push(client);
    }
  }

  const result = coaches.rows.map((coach: { id: number }) => ({
    ...coach,
    clients: clientsByCoach[coach.id] ?? [],
  }));

  res.json(result);
});

router.get("/admin/members", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const result = await pool.query(`
    SELECT u.id, u.email, u.full_name, u.coach_id,
      c.full_name AS coach_name,
      up.goal_mode, up.weight_kg
    FROM users u
    LEFT JOIN users c ON c.id = u.coach_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.role = 'member'
    ORDER BY u.full_name
  `);

  res.json(result.rows);
});

router.post("/admin/coaches/:coachId/clients/:clientId", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const coachId = parseInt(req.params["coachId"], 10);
  const clientId = parseInt(req.params["clientId"], 10);

  const coachCheck = await pool.query(`SELECT role FROM users WHERE id = $1`, [coachId]);
  if (!coachCheck.rows[0] || coachCheck.rows[0].role !== "coach") {
    res.status(400).json({ error: "Target user is not a coach" });
    return;
  }

  await pool.query(`UPDATE users SET coach_id = $1 WHERE id = $2`, [coachId, clientId]);
  res.json({ message: "Client assigned to coach" });
});

router.delete("/admin/coaches/:coachId/clients/:clientId", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const clientId = parseInt(req.params["clientId"], 10);
  await pool.query(`UPDATE users SET coach_id = NULL WHERE id = $1`, [clientId]);
  res.json({ message: "Client removed from coach" });
});

// ── Overview Stats ────────────────────────────────────────────────────────────

router.get("/admin/overview", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const [members, coaches, newThisMonth, unassigned, revenue] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'member' AND is_active = true`),
    pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'coach' AND is_active = true`),
    pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'member' AND created_at >= date_trunc('month', NOW())`),
    pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'member' AND is_active = true AND coach_id IS NULL`),
    pool.query(`
      SELECT COALESCE(SUM(cs.price * sub.client_count), 0)::numeric AS total
      FROM (
        SELECT u.coach_id, COUNT(*)::int AS client_count
        FROM users u
        WHERE u.role = 'member' AND u.is_active = true AND u.coach_id IS NOT NULL
        GROUP BY u.coach_id
      ) sub
      JOIN LATERAL (
        SELECT price FROM coach_services
        WHERE coach_id = sub.coach_id AND is_active = true
        ORDER BY created_at DESC LIMIT 1
      ) cs ON true
    `),
  ]);

  res.json({
    totalMembers: members.rows[0].count,
    totalCoaches: coaches.rows[0].count,
    newMembersThisMonth: newThisMonth.rows[0].count,
    unassignedMembers: unassigned.rows[0].count,
    estimatedMonthlyRevenue: Number(revenue.rows[0].total),
  });
});

// ── Reports ───────────────────────────────────────────────────────────────────

router.get("/admin/reports/growth", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const result = await pool.query(`
    SELECT
      to_char(date_trunc('month', created_at), 'Mon YY') AS month,
      date_trunc('month', created_at) AS month_date,
      COUNT(*)::int AS new_members
    FROM users
    WHERE role = 'member' AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY month_date, month
    ORDER BY month_date ASC
  `);

  res.json(result.rows);
});

router.get("/admin/reports/coaches", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const result = await pool.query(`
    SELECT
      u.id,
      COALESCE(u.full_name, split_part(u.email, '@', 1)) AS name,
      COUNT(m.id)::int AS client_count,
      COALESCE(cs.price, 0)::numeric AS service_price,
      (COUNT(m.id) * COALESCE(cs.price, 0))::numeric AS estimated_revenue
    FROM users u
    LEFT JOIN users m ON m.coach_id = u.id AND m.role = 'member' AND m.is_active = true
    LEFT JOIN LATERAL (
      SELECT price FROM coach_services
      WHERE coach_id = u.id AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    ) cs ON true
    WHERE u.role = 'coach' AND u.is_active = true
    GROUP BY u.id, u.full_name, u.email, cs.price
    ORDER BY estimated_revenue DESC, client_count DESC
  `);

  res.json(result.rows);
});

router.get("/admin/reports/goals", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const result = await pool.query(`
    SELECT
      COALESCE(up.goal_mode, 'not_set') AS goal_mode,
      COUNT(*)::int AS count
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.role = 'member' AND u.is_active = true
    GROUP BY up.goal_mode
    ORDER BY count DESC
  `);

  res.json(result.rows);
});

// ── Foods Management ─────────────────────────────────────────────────────────

router.post("/admin/foods", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { food_name, food_group, cooking_method, serving_unit, weigh_when, calories, protein_g, carbs_g, fat_g, fibre_g } = req.body;
  if (!food_name || !serving_unit || calories === undefined) {
    res.status(400).json({ error: "food_name, serving_unit, and calories are required" });
    return;
  }

  const result = await pool.query(`
    INSERT INTO foods (food_name, food_group, cooking_method, serving_unit, weigh_when, calories, protein_g, carbs_g, fat_g, fibre_g)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [food_name, food_group ?? 'other', cooking_method ?? 'raw', serving_unit, weigh_when ?? 'raw', calories, protein_g ?? 0, carbs_g ?? 0, fat_g ?? 0, fibre_g ?? 0]);

  res.status(201).json(result.rows[0]);
});

router.put("/admin/foods/:id", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params["id"], 10);
  const { food_name, food_group, cooking_method, serving_unit, weigh_when, calories, protein_g, carbs_g, fat_g, fibre_g } = req.body;

  const result = await pool.query(`
    UPDATE foods
    SET food_name = COALESCE($1, food_name),
        food_group = COALESCE($2, food_group),
        cooking_method = COALESCE($3, cooking_method),
        serving_unit = COALESCE($4, serving_unit),
        weigh_when = COALESCE($5, weigh_when),
        calories = COALESCE($6, calories),
        protein_g = COALESCE($7, protein_g),
        carbs_g = COALESCE($8, carbs_g),
        fat_g = COALESCE($9, fat_g),
        fibre_g = COALESCE($10, fibre_g)
    WHERE id = $11
    RETURNING *
  `, [food_name, food_group, cooking_method, serving_unit, weigh_when, calories, protein_g, carbs_g, fat_g, fibre_g, id]);

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Food not found" });
    return;
  }
  res.json(result.rows[0]);
});

router.delete("/admin/foods/:id", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params["id"], 10);
  await pool.query(`DELETE FROM foods WHERE id = $1`, [id]);
  res.json({ message: "Food deleted" });
});

router.get("/admin/foods", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const q = (req.query["q"] as string) ?? "";
  const result = await pool.query(`
    SELECT id, food_name, food_group, serving_unit, calories, protein_g, carbs_g, fat_g, fibre_g, dietary_tags
    FROM foods
    WHERE food_name ILIKE $1
    ORDER BY food_name
    LIMIT 100
  `, [`%${q}%`]);

  res.json(result.rows);
});

// ── Exercises Management ─────────────────────────────────────────────────────

router.get("/admin/exercises", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const q = (req.query["q"] as string) ?? "";
  const result = await pool.query(`
    SELECT id, exercise_name, exercise_type, muscle_primary, equipment, met_value
    FROM exercises
    WHERE exercise_name ILIKE $1
    ORDER BY exercise_name
    LIMIT 100
  `, [`%${q}%`]);

  res.json(result.rows);
});

router.post("/admin/exercises", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { exercise_name, exercise_type, muscle_primary, equipment, met_value } = req.body;
  if (!exercise_name || !exercise_type || !muscle_primary) {
    res.status(400).json({ error: "exercise_name, exercise_type, and muscle_primary are required" });
    return;
  }

  const result = await pool.query(`
    INSERT INTO exercises (exercise_name, exercise_type, muscle_primary, equipment, met_value)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [exercise_name, exercise_type, muscle_primary, equipment ?? 'bodyweight', met_value ?? null]);

  res.status(201).json(result.rows[0]);
});

router.put("/admin/exercises/:id", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params["id"], 10);
  const { exercise_name, exercise_type, muscle_primary, equipment, met_value } = req.body;

  const result = await pool.query(`
    UPDATE exercises
    SET exercise_name = COALESCE($1, exercise_name),
        exercise_type = COALESCE($2, exercise_type),
        muscle_primary = COALESCE($3, muscle_primary),
        equipment = COALESCE($4, equipment),
        met_value = COALESCE($5, met_value)
    WHERE id = $6
    RETURNING *
  `, [exercise_name, exercise_type, muscle_primary, equipment, met_value, id]);

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }
  res.json(result.rows[0]);
});

router.delete("/admin/exercises/:id", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params["id"], 10);
  await pool.query(`DELETE FROM exercises WHERE id = $1`, [id]);
  res.json({ message: "Exercise deleted" });
});

export default router;
