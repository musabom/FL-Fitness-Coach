import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
const router: IRouter = Router();

router.get("/public/services", async (req, res): Promise<void> => {
  const search = (req.query["search"] as string | undefined)?.trim() || "";

  const result = await pool.query(`
    SELECT
      cs.id AS service_id,
      cs.title,
      cs.description,
      cs.price,
      cs.specializations,
      cs.active_offer,
      cs.before_after_photos,
      u.id AS coach_id,
      COALESCE(u.full_name, split_part(u.email, '@', 1)) AS coach_name,
      cp.photo_url AS coach_photo,
      cp.bio AS coach_bio
    FROM coach_services cs
    INNER JOIN users u ON u.id = cs.coach_id
    LEFT JOIN coach_profiles cp ON cp.user_id = u.id
    WHERE cs.is_active = true
      AND u.is_active = true
      AND u.role = 'coach'
      AND (
        $1 = ''
        OR cs.title ILIKE $2
        OR u.full_name ILIKE $2
        OR split_part(u.email, '@', 1) ILIKE $2
        OR EXISTS (
          SELECT 1 FROM unnest(cs.specializations) AS s
          WHERE s ILIKE $2
        )
      )
    ORDER BY cs.created_at DESC
  `, [search, `%${search}%`]);

  res.json(result.rows.map(r => ({
    id: r.service_id,
    title: r.title,
    description: r.description,
    price: r.price ? Number(r.price) : null,
    specializations: r.specializations ?? [],
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
    coachId: r.coach_id,
    coachName: r.coach_name,
    coachPhoto: r.coach_photo ?? null,
    coachBio: r.coach_bio ?? null,
  })));
});

router.get("/public/services/:id", async (req, res): Promise<void> => {
  const serviceId = parseInt(req.params["id"], 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ error: "Invalid service ID" });
    return;
  }

  const result = await pool.query(`
    SELECT
      cs.id AS service_id,
      cs.title,
      cs.description,
      cs.price,
      cs.specializations,
      cs.active_offer,
      cs.before_after_photos,
      u.id AS coach_id,
      COALESCE(u.full_name, split_part(u.email, '@', 1)) AS coach_name,
      cp.photo_url AS coach_photo,
      cp.bio AS coach_bio
    FROM coach_services cs
    INNER JOIN users u ON u.id = cs.coach_id
    LEFT JOIN coach_profiles cp ON cp.user_id = u.id
    WHERE cs.id = $1 AND cs.is_active = true AND u.is_active = true AND u.role = 'coach'
  `, [serviceId]);

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  const r = result.rows[0];
  res.json({
    id: r.service_id,
    title: r.title,
    description: r.description,
    price: r.price ? Number(r.price) : null,
    specializations: r.specializations ?? [],
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
    coachId: r.coach_id,
    coachName: r.coach_name,
    coachPhoto: r.coach_photo ?? null,
    coachBio: r.coach_bio ?? null,
  });
});

// POST /public/services/:serviceId/subscribe — subscribe to a specific service
router.post("/public/services/:serviceId/subscribe", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "You must be signed in to subscribe" });
    return;
  }

  const serviceId = parseInt(req.params["serviceId"], 10);
  if (isNaN(serviceId)) {
    res.status(400).json({ error: "Invalid service ID" });
    return;
  }

  // Verify service exists and is active, get coach
  const serviceCheck = await pool.query(
    `SELECT cs.id, cs.coach_id, u.is_active as coach_active
     FROM coach_services cs
     JOIN users u ON u.id = cs.coach_id
     WHERE cs.id = $1 AND cs.is_active = true AND u.role = 'coach'`,
    [serviceId]
  );
  if (serviceCheck.rows.length === 0) {
    res.status(404).json({ error: "Service not found or inactive" });
    return;
  }
  const coachId = serviceCheck.rows[0].coach_id;

  // Only members can subscribe
  const userCheck = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.session.userId]);
  if (userCheck.rows[0]?.role !== "member") {
    res.status(403).json({ error: "Only members can subscribe" });
    return;
  }

  // Set coach_id, service_id, subscription_status = 'active', reset subscription period
  await pool.query(
    `UPDATE users
     SET coach_id = $1,
         service_id = $2,
         subscription_status = 'active',
         subscription_started_at = NOW()
     WHERE id = $3`,
    [coachId, serviceId, req.session.userId]
  );

  res.json({ message: "Subscribed to service successfully", coachId, serviceId });
});

// Legacy coach-level subscribe — kept for backwards compat, now also sets subscription_status
router.post("/public/coaches/:id/subscribe", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "You must be signed in to subscribe to a coach" });
    return;
  }

  const coachId = parseInt(req.params["id"], 10);
  if (isNaN(coachId)) {
    res.status(400).json({ error: "Invalid coach ID" });
    return;
  }

  const coachCheck = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND role = 'coach' AND is_active = true`,
    [coachId]
  );
  if (coachCheck.rows.length === 0) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  const userCheck = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.session.userId]);
  if (userCheck.rows[0]?.role !== "member") {
    res.status(403).json({ error: "Only members can subscribe to a coach" });
    return;
  }

  await pool.query(
    `UPDATE users
     SET coach_id = $1,
         subscription_status = 'active',
         subscription_started_at = NOW()
     WHERE id = $2`,
    [coachId, req.session.userId]
  );

  res.json({ message: "Subscribed to coach successfully", coachId });
});

export default router;
