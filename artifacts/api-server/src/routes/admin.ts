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

  // Delete user and cascade to related data
  await pool.query(`DELETE FROM users WHERE id = $1`, [targetId]);

  res.json({ message: "User deleted" });
});

// ── Coach-Client Assignment ──────────────────────────────────────────────────

router.get("/admin/coaches", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const coaches = await pool.query(`
    SELECT u.id, u.email, u.full_name, u.role,
      COUNT(c.id)::int AS client_count
    FROM users u
    LEFT JOIN users c ON c.coach_id = u.id
    WHERE u.role = 'coach'
    GROUP BY u.id
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

// ── Foods Management ─────────────────────────────────────────────────────────

router.post("/admin/foods", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { food_name, food_group, serving_unit, calories, protein_g, carbs_g, fat_g, fibre_g } = req.body;
  if (!food_name || !serving_unit || calories === undefined) {
    res.status(400).json({ error: "food_name, serving_unit, and calories are required" });
    return;
  }

  const result = await pool.query(`
    INSERT INTO foods (food_name, food_group, serving_unit, calories, protein_g, carbs_g, fat_g, fibre_g)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [food_name, food_group ?? null, serving_unit, calories, protein_g ?? 0, carbs_g ?? 0, fat_g ?? 0, fibre_g ?? 0]);

  res.status(201).json(result.rows[0]);
});

router.put("/admin/foods/:id", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params["id"], 10);
  const { food_name, food_group, serving_unit, calories, protein_g, carbs_g, fat_g, fibre_g } = req.body;

  const result = await pool.query(`
    UPDATE foods
    SET food_name = COALESCE($1, food_name),
        food_group = COALESCE($2, food_group),
        serving_unit = COALESCE($3, serving_unit),
        calories = COALESCE($4, calories),
        protein_g = COALESCE($5, protein_g),
        carbs_g = COALESCE($6, carbs_g),
        fat_g = COALESCE($7, fat_g),
        fibre_g = COALESCE($8, fibre_g)
    WHERE id = $9
    RETURNING *
  `, [food_name, food_group, serving_unit, calories, protein_g, carbs_g, fat_g, fibre_g, id]);

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
    SELECT id, food_name, food_group, serving_unit, calories, protein_g, carbs_g, fat_g, fibre_g
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
    SELECT id, name, exercise_type, muscle_group, equipment, met_value, description
    FROM exercises
    WHERE name ILIKE $1
    ORDER BY name
    LIMIT 100
  `, [`%${q}%`]);

  res.json(result.rows);
});

router.post("/admin/exercises", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { name, exercise_type, muscle_group, equipment, met_value, description } = req.body;
  if (!name || !exercise_type) {
    res.status(400).json({ error: "name and exercise_type are required" });
    return;
  }

  const result = await pool.query(`
    INSERT INTO exercises (name, exercise_type, muscle_group, equipment, met_value, description)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [name, exercise_type, muscle_group ?? null, equipment ?? null, met_value ?? null, description ?? null]);

  res.status(201).json(result.rows[0]);
});

router.put("/admin/exercises/:id", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const id = parseInt(req.params["id"], 10);
  const { name, exercise_type, muscle_group, equipment, met_value, description } = req.body;

  const result = await pool.query(`
    UPDATE exercises
    SET name = COALESCE($1, name),
        exercise_type = COALESCE($2, exercise_type),
        muscle_group = COALESCE($3, muscle_group),
        equipment = COALESCE($4, equipment),
        met_value = COALESCE($5, met_value),
        description = COALESCE($6, description)
    WHERE id = $7
    RETURNING *
  `, [name, exercise_type, muscle_group, equipment, met_value, description, id]);

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
