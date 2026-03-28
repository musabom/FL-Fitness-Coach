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
      u.subscription_started_at, u.subscription_status,
      u.service_id, cs.price AS service_price, cs.title AS service_title
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN coach_services cs ON cs.id = u.service_id
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
    const msPerDay = 86400000;
    if (client.subscription_started_at) {
      const daysElapsed = Math.floor((Date.now() - new Date(client.subscription_started_at).getTime()) / msPerDay);
      subscriptionDaysLeft = 30 - (daysElapsed % 30);
    }

    // Inactive: subscription_status is 'free' but they have a coach (was paying, now lapsed)
    // 'cancelling' = still active, leaving at end of period — coach must serve them
    const isInactive = client.subscription_status === "free" && client.subscription_started_at !== null;
    const isCancelling = client.subscription_status === "cancelling";

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
      subscriptionStatus: client.subscription_status ?? "free",
      serviceId: client.service_id ?? null,
      servicePrice: client.service_price ? Number(client.service_price) : null,
      serviceTitle: client.service_title ?? null,
      isInactive,
      isCancelling,
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

// GET /coach/stats — summary stats for the coach dashboard
router.get("/coach/stats", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const clientsRes = await pool.query(
    `SELECT u.id, u.subscription_started_at, u.subscription_status, up.goal_mode,
            u.service_id, cs.price AS service_price
     FROM users u
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN coach_services cs ON cs.id = u.service_id
     WHERE u.coach_id = $1`,
    [caller.userId]
  );
  const clients = clientsRes.rows;

  // Active = not inactive (subscription_status != 'free' OR no subscription yet)
  const activeClients = clients.filter(c => c.subscription_status !== "free" || c.subscription_started_at === null);
  const inactiveClients = clients.filter(c => c.subscription_status === "free" && c.subscription_started_at !== null);
  const totalClients = activeClients.length;

  // Real revenue: sum of each active client's service price (exact if tagged, else avg fallback)
  const avgRes = await pool.query(
    `SELECT COALESCE(AVG(price), 0) as avg_price FROM coach_services WHERE coach_id = $1 AND is_active = true`,
    [caller.userId]
  );
  const avgFallback = parseFloat(avgRes.rows[0]?.avg_price ?? "0");
  const monthlyRevenue = Math.round(
    activeClients.reduce((sum, c) => sum + (c.service_price ? Number(c.service_price) : avgFallback), 0) * 1000
  ) / 1000;

  // Clients expiring within 5 days
  const now = Date.now();
  const msPerDay = 86400000;
  const expiringSoon = activeClients.filter(c => {
    if (!c.subscription_started_at) return false;
    const daysElapsed = Math.floor((now - new Date(c.subscription_started_at).getTime()) / msPerDay);
    const daysLeft = 30 - (daysElapsed % 30);
    return daysLeft <= 5;
  }).length;

  // Clients renewing within the next 7 days
  const renewingThisWeek = activeClients.filter(c => {
    if (!c.subscription_started_at) return false;
    const daysElapsed = Math.floor((now - new Date(c.subscription_started_at).getTime()) / msPerDay);
    const daysLeft = 30 - (daysElapsed % 30);
    return daysLeft <= 7;
  }).length;

  // Goal distribution (active only)
  const goalCounts: Record<string, number> = {};
  for (const c of activeClients) {
    const g = c.goal_mode ?? "unknown";
    goalCounts[g] = (goalCounts[g] ?? 0) + 1;
  }

  res.json({ totalClients, monthlyRevenue, expiringSoon, renewingThisWeek, inactiveCount: inactiveClients.length, goalCounts });
});

// GET /coach/revenue-history — last 6 months of revenue based on subscription_started_at
router.get("/coach/revenue-history", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  // Get avg service price as fallback
  const avgRes = await pool.query(
    `SELECT COALESCE(AVG(price), 0) as avg_price FROM coach_services WHERE coach_id = $1 AND is_active = true`,
    [caller.userId]
  );
  const avgPrice = parseFloat(avgRes.rows[0]?.avg_price ?? "0");

  // Get all clients with their subscription_started_at and service price
  const clientsRes = await pool.query(
    `SELECT u.subscription_started_at, cs.price AS service_price
     FROM users u
     LEFT JOIN coach_services cs ON cs.id = u.service_id
     WHERE u.coach_id = $1 AND u.subscription_started_at IS NOT NULL`,
    [caller.userId]
  );

  // Build last 6 months buckets
  const months: { month: string; label: string; revenue: number; newClients: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en", { month: "short", year: "2-digit" });
    months.push({ month: monthKey, label, revenue: 0, newClients: 0 });
  }

  // Count new clients who started in each month
  for (const client of clientsRes.rows) {
    const d = new Date(client.subscription_started_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find(m => m.month === monthKey);
    if (bucket) {
      const price = client.service_price ? Number(client.service_price) : avgPrice;
      bucket.newClients++;
      bucket.revenue += price;
    }
  }

  res.json(months);
});

// GET /coach/clients/:id/notes — get notes for a client
router.get("/coach/clients/:id/notes", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }

  // Verify ownership
  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") {
    res.status(403).json({ error: "Not your client" }); return;
  }

  let notes: any[] = [];
  try {
    const r = await pool.query(
      `SELECT id, note, created_at FROM coach_client_notes WHERE coach_id = $1 AND client_id = $2 ORDER BY created_at DESC`,
      [caller.userId, clientId]
    );
    notes = r.rows;
  } catch {
    // table may not exist yet in all envs
  }
  res.json(notes);
});

// POST /coach/clients/:id/notes — add a note for a client
router.post("/coach/clients/:id/notes", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }

  const { note } = req.body;
  if (!note || typeof note !== "string" || note.trim().length === 0) {
    res.status(400).json({ error: "Note text is required" }); return;
  }

  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") {
    res.status(403).json({ error: "Not your client" }); return;
  }

  let newNote: any = null;
  try {
    const r = await pool.query(
      `INSERT INTO coach_client_notes (coach_id, client_id, note) VALUES ($1, $2, $3) RETURNING id, note, created_at`,
      [caller.userId, clientId, note.trim()]
    );
    newNote = r.rows[0];
  } catch {
    res.status(500).json({ error: "Failed to save note" }); return;
  }
  res.json(newNote);
});

// DELETE /coach/clients/:clientId/notes/:noteId — delete a note
router.delete("/coach/clients/:clientId/notes/:noteId", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const noteId = parseInt(req.params["noteId"], 10);
  if (isNaN(noteId)) { res.status(400).json({ error: "Invalid note ID" }); return; }

  try {
    await pool.query(`DELETE FROM coach_client_notes WHERE id = $1 AND coach_id = $2`, [noteId, caller.userId]);
  } catch { /* ignore */ }
  res.json({ message: "Deleted" });
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
