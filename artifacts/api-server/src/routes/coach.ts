import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireCoachOrAdmin, requireAuth } from "../middleware/role";

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
    // Today's meal compliance
    let mealCompliance: number | null = null;
    try {
      const mealRes = await pool.query(`
        SELECT
          COUNT(DISTINCT mp.id)::int AS planned_portions,
          COUNT(DISTINCT mpc.portion_id)::int AS completed_portions
        FROM user_meals um
        JOIN meal_portions mp ON mp.meal_id = um.id
        LEFT JOIN meal_portion_completions mpc
          ON mpc.portion_id = mp.id
          AND mpc.date = $2
          AND mpc.user_id = $1
        WHERE um.user_id = $1
      `, [client.id, dateStr]);
      const mealRow = mealRes.rows[0];
      if (mealRow?.planned_portions > 0) {
        mealCompliance = Math.round((mealRow.completed_portions / mealRow.planned_portions) * 100);
      }
    } catch (e) {
      console.error("Meal compliance query failed:", e);
    }

    // Today's workout compliance
    let workoutCompliance: number | null = null;
    try {
      const workoutRes = await pool.query(`
        SELECT
          COUNT(DISTINCT we.id)::int AS planned_exercises,
          COUNT(DISTINCT wec.workout_exercise_id)::int AS completed_exercises
        FROM user_workouts uw
        JOIN workout_exercises we ON we.workout_id = uw.id
        LEFT JOIN workout_exercise_completions wec
          ON wec.workout_exercise_id = we.id
          AND wec.date = $2
          AND wec.user_id = $1
        WHERE uw.user_id = $1
      `, [client.id, dateStr]);
      const workoutRow = workoutRes.rows[0];
      if (workoutRow?.planned_exercises > 0) {
        workoutCompliance = Math.round((workoutRow.completed_exercises / workoutRow.planned_exercises) * 100);
      }
    } catch (e) {
      console.error("Workout compliance query failed:", e);
    }

    let subscriptionDaysLeft: number | null = null;
    const msPerDay = 86400000;
    if (client.subscription_started_at) {
      const daysElapsed = Math.floor((Date.now() - new Date(client.subscription_started_at).getTime()) / msPerDay);
      subscriptionDaysLeft = 30 - (daysElapsed % 30);
    }

    // Active statuses: 'active' or 'cancelling' (still serving until period ends)
    // Inactive: subscription lapsed — status is 'free' AND their 30-day window has expired
    // Edge case: if status is 'free' but subscription_started_at is set and days left > 0,
    // treat as active (data inconsistency from invite signup — heal by updating status)
    const isCancelling = client.subscription_status === "cancelling";
    const hasActivePeriod = subscriptionDaysLeft !== null && subscriptionDaysLeft > 0;
    const isActiveStatus = client.subscription_status === "active" || client.subscription_status === "cancelling";

    // Auto-heal: if status is 'free' but they're within an active period, fix the status
    if (client.subscription_status === "free" && client.subscription_started_at !== null && hasActivePeriod) {
      try {
        await pool.query(
          `UPDATE users SET subscription_status = 'active' WHERE id = $1 AND subscription_status = 'free'`,
          [client.id]
        );
        client.subscription_status = "active";
      } catch { /* ignore */ }
    }

    const isInactive = !isActiveStatus && !hasActivePeriod && client.subscription_started_at !== null;

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

// GET /coach/financials — earnings breakdown with platform commission split
router.get("/coach/financials", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  // Platform commission rate
  const settingsRes = await pool.query(
    `SELECT value FROM platform_settings WHERE key = 'platform_commission_pct'`
  );
  const commissionPct = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].value) : 10;

  // Per-service revenue breakdown (active/cancelling subscribers only)
  const result = await pool.query(`
    SELECT
      cs.id          AS service_id,
      cs.title       AS service_title,
      COALESCE(cs.price, 0)::numeric AS price,
      COUNT(u.id)::int AS client_count
    FROM coach_services cs
    LEFT JOIN users u ON u.service_id = cs.id
      AND u.role = 'member'
      AND u.is_active = true
      AND u.subscription_status IN ('active', 'cancelling')
    WHERE cs.coach_id = $1 AND cs.is_active = true
    GROUP BY cs.id, cs.title, cs.price
    ORDER BY (COALESCE(cs.price, 0) * COUNT(u.id)) DESC
  `, [caller.userId]);

  const services = result.rows.map(r => {
    const gross = Number(r.price) * r.client_count;
    const platformCut = gross * commissionPct / 100;
    return {
      serviceId: r.service_id,
      serviceTitle: r.service_title,
      price: Number(r.price),
      clientCount: r.client_count,
      gross,
      platformCut,
      coachEarnings: gross - platformCut,
    };
  });

  const totalGross = services.reduce((sum, s) => sum + s.gross, 0);
  const totalPlatformCut = totalGross * commissionPct / 100;

  res.json({
    commissionPct,
    coachPct: 100 - commissionPct,
    totalGross,
    platformCut: totalPlatformCut,
    coachEarnings: totalGross - totalPlatformCut,
    services,
  });
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

// PUT /coach/clients/:clientId/notes/:noteId — edit a note
router.put("/coach/clients/:clientId/notes/:noteId", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const noteId = parseInt(req.params["noteId"], 10);
  if (isNaN(noteId)) { res.status(400).json({ error: "Invalid note ID" }); return; }
  const { note } = req.body;
  if (!note?.trim()) { res.status(400).json({ error: "Note text required" }); return; }
  const r = await pool.query(
    `UPDATE coach_client_notes SET note = $1 WHERE id = $2 AND coach_id = $3 RETURNING *`,
    [note.trim(), noteId, caller.userId]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: "Note not found" }); return; }
  res.json(r.rows[0]);
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

// ── Assign service to client ──────────────────────────────────────────────────
router.put("/coach/clients/:id/service", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }
  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") { res.status(403).json({ error: "Not your client" }); return; }
  const { serviceId } = req.body;
  if (serviceId !== null && serviceId !== undefined) {
    const svcCheck = await pool.query(`SELECT id FROM coach_services WHERE id = $1 AND coach_id = $2`, [serviceId, caller.userId]);
    if (svcCheck.rows.length === 0) { res.status(404).json({ error: "Service not found" }); return; }
  }
  await pool.query(`UPDATE users SET service_id = $1 WHERE id = $2`, [serviceId ?? null, clientId]);
  res.json({ message: "Service assigned" });
});

// ── Weight history for a client ───────────────────────────────────────────────
router.get("/coach/clients/:id/weight-history", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }
  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") { res.status(403).json({ error: "Not your client" }); return; }
  const r = await pool.query(
    `SELECT weight_kg, recorded_at FROM weight_history WHERE user_id = $1 ORDER BY recorded_at ASC LIMIT 90`,
    [clientId]
  );
  res.json(r.rows.map(row => ({ weightKg: row.weight_kg, date: row.recorded_at })));
});

// ── Check-ins ─────────────────────────────────────────────────────────────────
// GET /coach/clients/:id/checkins — coach views check-ins for a client
router.get("/coach/clients/:id/checkins", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }
  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") { res.status(403).json({ error: "Not your client" }); return; }
  const r = await pool.query(
    `SELECT id, week_date, weight_kg, energy_level, sleep_quality, notes, created_at
     FROM client_checkins WHERE client_id = $1 ORDER BY week_date DESC LIMIT 12`,
    [clientId]
  );
  res.json(r.rows);
});

// POST /checkins — member submits weekly check-in
router.post("/checkins", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { weightKg, energyLevel, sleepQuality, notes } = req.body;
  // Get this member's coach
  const userRes = await pool.query(`SELECT coach_id FROM users WHERE id = $1`, [userId]);
  const coachId = userRes.rows[0]?.coach_id;
  if (!coachId) { res.status(400).json({ error: "No coach assigned" }); return; }
  // Get current ISO week date (Monday)
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const weekDate = monday.toISOString().split("T")[0];
  const r = await pool.query(
    `INSERT INTO client_checkins (client_id, coach_id, week_date, weight_kg, energy_level, sleep_quality, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (client_id, week_date) DO UPDATE SET
       weight_kg = EXCLUDED.weight_kg,
       energy_level = EXCLUDED.energy_level,
       sleep_quality = EXCLUDED.sleep_quality,
       notes = EXCLUDED.notes,
       created_at = NOW()
     RETURNING *`,
    [userId, coachId, weekDate, weightKg ?? null, energyLevel ?? null, sleepQuality ?? null, notes ?? null]
  );
  res.json(r.rows[0]);
});

// GET /checkins/me — member views their own check-ins
router.get("/checkins/me", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const r = await pool.query(
    `SELECT id, week_date, weight_kg, energy_level, sleep_quality, notes, created_at
     FROM client_checkins WHERE client_id = $1 ORDER BY week_date DESC LIMIT 12`,
    [userId]
  );
  res.json(r.rows);
});

// ── Messaging ─────────────────────────────────────────────────────────────────
// GET /coach/clients/:id/messages
router.get("/coach/clients/:id/messages", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }
  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") { res.status(403).json({ error: "Not your client" }); return; }
  // Mark messages from client as read
  await pool.query(
    `UPDATE coach_messages SET read_at = NOW() WHERE coach_id = $1 AND client_id = $2 AND from_coach = FALSE AND read_at IS NULL`,
    [caller.userId, clientId]
  );
  const r = await pool.query(
    `SELECT id, content, from_coach, read_at, created_at FROM coach_messages
     WHERE coach_id = $1 AND client_id = $2 ORDER BY created_at ASC LIMIT 100`,
    [caller.userId, clientId]
  );
  res.json(r.rows);
});

// POST /coach/clients/:id/messages — coach sends message
router.post("/coach/clients/:id/messages", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }
  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") { res.status(403).json({ error: "Not your client" }); return; }
  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "Message content required" }); return; }
  const r = await pool.query(
    `INSERT INTO coach_messages (coach_id, client_id, content, from_coach) VALUES ($1, $2, $3, TRUE) RETURNING *`,
    [caller.userId, clientId, content.trim()]
  );
  res.json(r.rows[0]);
});

// GET /messages/me — member gets their messages (does NOT mark as read)
router.get("/messages/me", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const userRes = await pool.query(`SELECT coach_id FROM users WHERE id = $1`, [userId]);
  const coachId = userRes.rows[0]?.coach_id;
  if (!coachId) { res.json([]); return; }
  const r = await pool.query(
    `SELECT id, content, from_coach, read_at, created_at FROM coach_messages
     WHERE coach_id = $1 AND client_id = $2 ORDER BY created_at ASC LIMIT 100`,
    [coachId, userId]
  );
  res.json(r.rows);
});

// POST /messages/me/read — member explicitly marks coach messages as read (called when chat opens)
router.post("/messages/me/read", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const userRes = await pool.query(`SELECT coach_id FROM users WHERE id = $1`, [userId]);
  const coachId = userRes.rows[0]?.coach_id;
  if (!coachId) { res.json({ ok: true }); return; }
  await pool.query(
    `UPDATE coach_messages SET read_at = NOW() WHERE coach_id = $1 AND client_id = $2 AND from_coach = TRUE AND read_at IS NULL`,
    [coachId, userId]
  );
  res.json({ ok: true });
});

// POST /messages/me — member sends message to coach
router.post("/messages/me", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const userRes = await pool.query(`SELECT coach_id FROM users WHERE id = $1`, [userId]);
  const coachId = userRes.rows[0]?.coach_id;
  if (!coachId) { res.status(400).json({ error: "No coach assigned" }); return; }
  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "Message content required" }); return; }
  const r = await pool.query(
    `INSERT INTO coach_messages (coach_id, client_id, content, from_coach) VALUES ($1, $2, $3, FALSE) RETURNING *`,
    [coachId, userId, content.trim()]
  );
  res.json(r.rows[0]);
});

// ── Per-service invite links ──────────────────────────────────────────────────
// GET /coach/service-invite-links — returns one invite URL per active service
router.get("/coach/service-invite-links", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;

  const baseUrl = (req.headers.origin as string) || `http://localhost:5173`;

  const svcRes = await pool.query(
    `SELECT id, title, price FROM coach_services WHERE coach_id = $1 AND is_active = true ORDER BY created_at ASC`,
    [caller.userId]
  );

  const result = [];
  for (const svc of svcRes.rows) {
    let tokenRes = await pool.query(
      `SELECT token FROM coach_invite_tokens WHERE coach_id = $1 AND service_id = $2`,
      [caller.userId, svc.id]
    );
    if (tokenRes.rows.length === 0) {
      const token = `s${svc.id}_${Math.random().toString(36).slice(2, 10)}`;
      await pool.query(
        `INSERT INTO coach_invite_tokens (coach_id, service_id, token) VALUES ($1, $2, $3) ON CONFLICT (coach_id, service_id) WHERE service_id IS NOT NULL DO NOTHING`,
        [caller.userId, svc.id, token]
      );
      tokenRes = await pool.query(
        `SELECT token FROM coach_invite_tokens WHERE coach_id = $1 AND service_id = $2`,
        [caller.userId, svc.id]
      );
    }
    const token = tokenRes.rows[0]?.token;
    if (!token) continue;
    result.push({
      serviceId: svc.id,
      serviceTitle: svc.title,
      servicePrice: svc.price ? Number(svc.price) : null,
      token,
      inviteUrl: `${baseUrl}/signup?ref=${token}`,
    });
  }

  res.json(result);
});

// ── Unread message counts ─────────────────────────────────────────────────────
router.get("/coach/unread-counts", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const r = await pool.query(
    `SELECT client_id, COUNT(*)::int as unread FROM coach_messages
     WHERE coach_id = $1 AND from_coach = FALSE AND read_at IS NULL
     GROUP BY client_id`,
    [caller.userId]
  );
  const counts: Record<number, number> = {};
  for (const row of r.rows) counts[row.client_id] = row.unread;
  res.json(counts);
});

// ── Plan status for client ────────────────────────────────────────────────────
router.get("/coach/clients/:id/plan-status", async (req, res): Promise<void> => {
  const caller = await requireCoachOrAdmin(req, res);
  if (!caller) return;
  const clientId = parseInt(req.params["id"], 10);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid client ID" }); return; }
  const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, caller.userId]);
  if (check.rows.length === 0 && caller.role !== "admin") { res.status(403).json({ error: "Not your client" }); return; }
  const r = await pool.query(
    `SELECT coach_updated_at, created_at FROM plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1`,
    [clientId]
  );
  const plan = r.rows[0];
  res.json({ coachUpdatedAt: plan?.coach_updated_at ?? null, planCreatedAt: plan?.created_at ?? null });
});

export default router;
