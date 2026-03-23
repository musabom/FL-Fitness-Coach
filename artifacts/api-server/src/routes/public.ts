import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

/**
 * GET /public/coaches
 * List all active coaches with their profiles. No authentication required.
 * Supports ?search= query param for filtering by name or specialization.
 */
router.get("/public/coaches", async (req, res): Promise<void> => {
  const search = (req.query["search"] as string | undefined)?.trim() || "";

  const result = await pool.query(`
    SELECT
      u.id,
      u.full_name,
      cp.photo_url,
      cp.specializations,
      cp.price_per_month,
      cp.bio,
      cp.active_offer,
      cp.before_after_photos
    FROM users u
    INNER JOIN coach_profiles cp ON cp.user_id = u.id
    WHERE u.role = 'coach'
      AND u.is_active = true
      AND (
        $1 = ''
        OR u.full_name ILIKE $2
        OR EXISTS (
          SELECT 1 FROM unnest(cp.specializations) AS s
          WHERE s ILIKE $2
        )
      )
    ORDER BY u.full_name ASC
  `, [search, `%${search}%`]);

  res.json(result.rows.map(r => ({
    id: r.id,
    fullName: r.full_name,
    photoUrl: r.photo_url,
    specializations: r.specializations ?? [],
    pricePerMonth: r.price_per_month ? Number(r.price_per_month) : null,
    bio: r.bio,
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
  })));
});

/**
 * GET /public/coaches/:id
 * Get a single coach's public profile. No authentication required.
 */
router.get("/public/coaches/:id", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params["id"], 10);
  if (isNaN(coachId)) {
    res.status(400).json({ error: "Invalid coach ID" });
    return;
  }

  const result = await pool.query(`
    SELECT
      u.id,
      u.full_name,
      cp.photo_url,
      cp.specializations,
      cp.price_per_month,
      cp.bio,
      cp.active_offer,
      cp.before_after_photos
    FROM users u
    INNER JOIN coach_profiles cp ON cp.user_id = u.id
    WHERE u.id = $1 AND u.role = 'coach' AND u.is_active = true
  `, [coachId]);

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  const r = result.rows[0];
  res.json({
    id: r.id,
    fullName: r.full_name,
    photoUrl: r.photo_url,
    specializations: r.specializations ?? [],
    pricePerMonth: r.price_per_month ? Number(r.price_per_month) : null,
    bio: r.bio,
    activeOffer: r.active_offer,
    beforeAfterPhotos: r.before_after_photos ?? [],
  });
});

/**
 * POST /public/coaches/:id/subscribe
 * Subscribe the current logged-in user to a coach.
 * Requires authentication.
 */
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

  // Verify the coach exists and is active
  const coachCheck = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND role = 'coach' AND is_active = true`,
    [coachId]
  );
  if (coachCheck.rows.length === 0) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  // Verify caller is a member (not admin or coach)
  const userCheck = await pool.query(
    `SELECT role FROM users WHERE id = $1`,
    [req.session.userId]
  );
  const userRole = userCheck.rows[0]?.role;
  if (userRole !== "member") {
    res.status(403).json({ error: "Only members can subscribe to a coach" });
    return;
  }

  await pool.query(
    `UPDATE users SET coach_id = $1 WHERE id = $2`,
    [coachId, req.session.userId]
  );

  res.json({ message: "Subscribed to coach successfully", coachId });
});

export default router;
