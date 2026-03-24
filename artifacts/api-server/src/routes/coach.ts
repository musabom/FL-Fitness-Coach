import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireCoachOrAdmin } from "../middleware/role";

const router: IRouter = Router();

const EFFORT_MET: Record<string, number> = { light: 3.5, moderate: 5.0, heavy: 6.0 };

function calcCalories(row: {
  exercise_type: string; met_value: string | null;
  sets: string; reps_min: string; reps_max: string; rest_seconds: string;
  duration_mins: string | null; effort_level: string | null;
}, weightKg: number): number {
  if (row.exercise_type === "cardio") {
    const met = Number(row.met_value) || 5;
    const dur = Number(row.duration_mins) || 0;
    return +(met * weightKg * (dur / 60)).toFixed(1);
  }
  const sets = Number(row.sets);
  const avgReps = (Number(row.reps_min) + Number(row.reps_max)) / 2;
  const rest = Number(row.rest_seconds);
  const durMins = (sets * (avgReps * 3 + rest)) / 60;
  const met = EFFORT_MET[row.effort_level ?? "moderate"] ?? EFFORT_MET.moderate;
  return +(met * weightKg * (durMins / 60)).toFixed(1);
}

router.get("/coach/clients", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const todayDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][today.getDay()];

  const clientsRes = await pool.query(`
    SELECT
      u.id, u.email, u.full_name,
      up.goal_mode, up.weight_kg, up.target_weight_kg,
      u.subscription_started_at
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.coach_id = $1
    ORDER BY u.full_name
  `, [caller.userId]);

  const clients = clientsRes.rows;
  const enriched = [];

  for (const client of clients) {
    // Today's meal compliance — guarded: table may not exist in all environments
    let mealCompliance: number | null = null;
    try {
      const mealRes = await pool.query(`
        SELECT
          COUNT(DISTINCT mp.id)::int AS planned_portions,
          COUNT(DISTINCT mpc.portion_id)::int AS completed_portions
        FROM meals m
        JOIN meal_portions mp ON mp.meal_id = m.id
        LEFT JOIN meal_portion_completions mpc ON mpc.portion_id = mp.id AND mpc.completed_date = $2
        WHERE m.user_id = $1
          AND (m.scheduled_days IS NULL OR m.scheduled_days::jsonb @> $3::jsonb)
      `, [client.id, dateStr, JSON.stringify([todayDay])]);
      const mealRow = mealRes.rows[0];
      if (mealRow?.planned_portions > 0) {
        mealCompliance = Math.round((mealRow.completed_portions / mealRow.planned_portions) * 100);
      }
    } catch {
      // Table not yet available in this environment — skip compliance
    }

    // Today's workout compliance — guarded: table may not exist in all environments
    let workoutCompliance: number | null = null;
    try {
      const workoutRes = await pool.query(`
        SELECT
          COUNT(DISTINCT we.id)::int AS planned_exercises,
          COUNT(DISTINCT ws_done.id)::int AS completed_exercises
        FROM workouts w
        JOIN workout_exercises we ON we.workout_id = w.id
        LEFT JOIN workout_sessions ws ON ws.workout_id = w.id AND DATE(ws.completed_at) = $2
        LEFT JOIN workout_session_exercises ws_done ON ws_done.session_id = ws.id AND ws_done.workout_exercise_id = we.id
        WHERE w.user_id = $1
          AND (w.scheduled_days IS NULL OR w.scheduled_days::jsonb @> $3::jsonb)
      `, [client.id, dateStr, JSON.stringify([todayDay])]);
      const workoutRow = workoutRes.rows[0];
      if (workoutRow?.planned_exercises > 0) {
        workoutCompliance = Math.round((workoutRow.completed_exercises / workoutRow.planned_exercises) * 100);
      }
    } catch {
      // Table not yet available in this environment — skip compliance
    }

    let subscriptionDaysLeft: number | null = null;
    if (client.subscription_started_at) {
      const msPerDay = 86400000;
      const daysElapsed = Math.floor((Date.now() - new Date(client.subscription_started_at).getTime()) / msPerDay);
      subscriptionDaysLeft = 30 - (daysElapsed % 30);
    }

    enriched.push({
      id: client.id,
      email: client.email,
      fullName: client.full_name,
      goalMode: client.goal_mode,
      weightKg: client.weight_kg,
      targetWeightKg: client.target_weight_kg,
      mealCompliancePct: mealCompliance,
      workoutCompliancePct: workoutCompliance,
      subscriptionStartedAt: client.subscription_started_at ?? null,
      subscriptionDaysLeft,
    });
  }

  res.json(enriched);
});

// GET /coach/profile — get own coach profile (personal info only)
router.get("/coach/profile", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const result = await pool.query(
    `SELECT cp.photo_url, cp.bio, u.full_name
     FROM users u
     LEFT JOIN coach_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1`,
    [caller.userId]
  );

  const r = result.rows[0];
  res.json({
    fullName: r?.full_name || null,
    photoUrl: r?.photo_url || null,
    bio: r?.bio || null,
  });
});

// PUT /coach/profile — save personal profile info only (photo, name, bio)
router.put("/coach/profile", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const { fullName, photoUrl, bio } = req.body;

  if (bio && bio.length > 150) {
    res.status(400).json({ error: "Bio must be 150 characters or fewer" });
    return;
  }

  // Update full_name in users table
  if (fullName !== undefined) {
    await pool.query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName || null, caller.userId]);
  }

  // Upsert coach_profiles — only touch photo_url and bio, preserve all other fields
  await pool.query(`
    INSERT INTO coach_profiles (user_id, photo_url, bio, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      photo_url = EXCLUDED.photo_url,
      bio = EXCLUDED.bio,
      updated_at = NOW()
  `, [caller.userId, photoUrl ?? null, bio ?? null]);

  res.json({ message: "Profile updated" });
});

// ── Coach Services CRUD ─────────────────────────────────────────────────────

router.get("/coach/services", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const result = await pool.query(
    `SELECT * FROM coach_services WHERE coach_id = $1 ORDER BY created_at DESC`,
    [caller.userId]
  );

  res.json(result.rows.map(r => ({
    id: r.id,
    coachId: r.coach_id,
    title: r.title,
    description: r.description,
    price: r.price ? Number(r.price) : null,
    specializations: r.specializations ?? [],
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

router.post("/coach/services", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const { title, description, price, specializations, activeOffer, beforeAfterPhotos } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  if (specializations && (!Array.isArray(specializations) || specializations.length > 5)) {
    res.status(400).json({ error: "Specializations must be an array of up to 5 tags" });
    return;
  }

  const result = await pool.query(`
    INSERT INTO coach_services (coach_id, title, description, price, specializations, active_offer, before_after_photos, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `, [
    caller.userId,
    title.trim(),
    description ?? null,
    price ?? null,
    specializations ?? [],
    activeOffer ?? null,
    beforeAfterPhotos ?? [],
  ]);

  const r = result.rows[0];
  res.json({
    id: r.id,
    coachId: r.coach_id,
    title: r.title,
    description: r.description,
    price: r.price ? Number(r.price) : null,
    specializations: r.specializations ?? [],
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
});

router.put("/coach/services/:id", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const serviceId = parseInt(req.params["id"], 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ error: "Invalid service ID" });
    return;
  }

  const ownerCheck = await pool.query(
    `SELECT id FROM coach_services WHERE id = $1 AND coach_id = $2`,
    [serviceId, caller.userId]
  );
  if (ownerCheck.rows.length === 0) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  const body = req.body;
  const { title, description, price, specializations, activeOffer, beforeAfterPhotos, isActive } = body;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    res.status(400).json({ error: "Title cannot be empty" });
    return;
  }

  if (specializations !== undefined && (!Array.isArray(specializations) || specializations.length > 5)) {
    res.status(400).json({ error: "Specializations must be an array of up to 5 tags" });
    return;
  }

  const setClauses: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [serviceId];
  let paramIdx = 2;

  function addField(column: string, value: unknown, key: string) {
    if (key in body) {
      setClauses.push(`${column} = $${paramIdx}`);
      values.push(value);
      paramIdx++;
    }
  }

  addField("title", title?.trim() ?? null, "title");
  addField("description", description ?? null, "description");
  addField("price", price ?? null, "price");
  addField("specializations", specializations ?? [], "specializations");
  addField("active_offer", activeOffer ?? null, "activeOffer");
  addField("before_after_photos", beforeAfterPhotos ?? [], "beforeAfterPhotos");
  addField("is_active", isActive ?? true, "isActive");

  const result = await pool.query(`
    UPDATE coach_services SET ${setClauses.join(", ")}
    WHERE id = $1
    RETURNING *
  `, values);

  const r = result.rows[0];
  res.json({
    id: r.id,
    coachId: r.coach_id,
    title: r.title,
    description: r.description,
    price: r.price ? Number(r.price) : null,
    specializations: r.specializations ?? [],
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
});

router.delete("/coach/services/:id", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const serviceId = parseInt(req.params["id"], 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ error: "Invalid service ID" });
    return;
  }

  const result = await pool.query(
    `DELETE FROM coach_services WHERE id = $1 AND coach_id = $2 RETURNING id`,
    [serviceId, caller.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.json({ message: "Service deleted" });
});

// Mark plan as coach-updated (called when coach saves any change to client data)
router.post("/coach/clients/:clientId/mark-updated", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const clientId = parseInt(req.params["clientId"], 10);

  const accessCheck = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND coach_id = $2`,
    [clientId, caller.userId]
  );
  if (accessCheck.rows.length === 0 && caller.role !== "admin") {
    res.status(403).json({ error: "Not your client" });
    return;
  }

  await pool.query(`
    UPDATE plans SET coach_updated_at = NOW()
    WHERE user_id = $1
      AND id = (SELECT id FROM plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1)
  `, [clientId]);

  res.json({ message: "Plan marked as coach-updated" });
});

export default router;
