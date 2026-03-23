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
      up.goal_mode, up.weight_kg, up.target_weight_kg
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.coach_id = $1
    ORDER BY u.full_name
  `, [caller.userId]);

  const clients = clientsRes.rows;
  const enriched = [];

  for (const client of clients) {
    const weightKg = Number(client.weight_kg) || 70;

    // Today's meal compliance
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
    const mealCompliance = mealRow?.planned_portions > 0
      ? Math.round((mealRow.completed_portions / mealRow.planned_portions) * 100)
      : null;

    // Today's workout compliance
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
    const workoutCompliance = workoutRow?.planned_exercises > 0
      ? Math.round((workoutRow.completed_exercises / workoutRow.planned_exercises) * 100)
      : null;

    enriched.push({
      id: client.id,
      email: client.email,
      fullName: client.full_name,
      goalMode: client.goal_mode,
      weightKg: client.weight_kg,
      targetWeightKg: client.target_weight_kg,
      mealCompliancePct: mealCompliance,
      workoutCompliancePct: workoutCompliance,
    });
  }

  res.json(enriched);
});

// GET /coach/profile — get own coach profile
router.get("/coach/profile", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const result = await pool.query(
    `SELECT * FROM coach_profiles WHERE user_id = $1`,
    [caller.userId]
  );

  if (result.rows.length === 0) {
    res.json({
      photoUrl: null,
      specializations: [],
      pricePerMonth: null,
      bio: null,
      activeOffer: null,
      beforeAfterPhotos: [],
    });
    return;
  }

  const r = result.rows[0];
  res.json({
    photoUrl: r.photo_url,
    specializations: r.specializations ?? [],
    pricePerMonth: r.price_per_month ? Number(r.price_per_month) : null,
    bio: r.bio,
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
  });
});

// PUT /coach/profile — upsert coach profile
router.put("/coach/profile", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const { photoUrl, specializations, pricePerMonth, bio, activeOffer, beforeAfterPhotos } = req.body;

  // Validate
  if (bio && bio.length > 150) {
    res.status(400).json({ error: "Bio must be 150 characters or fewer" });
    return;
  }
  if (specializations && (!Array.isArray(specializations) || specializations.length > 3)) {
    res.status(400).json({ error: "Specializations must be an array of 1-3 tags" });
    return;
  }

  await pool.query(`
    INSERT INTO coach_profiles (user_id, photo_url, specializations, price_per_month, bio, active_offer, before_after_photos, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      photo_url = EXCLUDED.photo_url,
      specializations = EXCLUDED.specializations,
      price_per_month = EXCLUDED.price_per_month,
      bio = EXCLUDED.bio,
      active_offer = EXCLUDED.active_offer,
      before_after_photos = EXCLUDED.before_after_photos,
      updated_at = NOW()
  `, [
    caller.userId,
    photoUrl ?? null,
    specializations ?? [],
    pricePerMonth ?? null,
    bio ?? null,
    activeOffer ?? null,
    beforeAfterPhotos ?? [],
  ]);

  res.json({ message: "Profile updated" });
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
