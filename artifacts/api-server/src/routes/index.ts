import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import planRouter from "./plan";
import goalsRouter from "./goals";
import foodsRouter from "./foods";
import mealsRouter from "./meals";
import mealPlanRouter from "./meal-plan";
import shoppingListRouter from "./shopping-list";
import workoutsRouter from "./workouts";
import workoutPlanRouter from "./workout-plan";
import dashboardRouter from "./dashboard";
import progressRouter from "./progress";
import adminRouter from "./admin";
import coachRouter from "./coach";
import logsRouter from "./logs";
import publicRouter from "./public";
import storageRouter from "./storage";

const router: IRouter = Router();

/**
 * Global middleware: resolve effective userId for coach/admin client impersonation.
 * If ?clientId= is present and the caller is a coach with that client assigned
 * (or admin), sets res.locals.userId to clientId. Otherwise sets it to session userId.
 */
router.use(async (req, res, next) => {
  if (!req.session.userId) return next();
  res.locals.userId = req.session.userId;
  res.locals.coachId = null;

  const clientIdParam = req.query["clientId"] as string | undefined;
  if (!clientIdParam) return next();

  const clientId = parseInt(clientIdParam, 10);
  if (isNaN(clientId)) return next();

  const callerRes = await pool.query(`SELECT role FROM users WHERE id = $1`, [req.session.userId]);
  const role = callerRes.rows[0]?.role;

  if (role === "admin") {
    res.locals.userId = clientId;
    res.locals.coachId = req.session.userId;
    return next();
  }

  if (role === "coach") {
    const check = await pool.query(`SELECT id FROM users WHERE id = $1 AND coach_id = $2`, [clientId, req.session.userId]);
    if (check.rows.length > 0) {
      res.locals.userId = clientId;
      res.locals.coachId = req.session.userId;
      return next();
    }
    res.status(403).json({ error: "Not your client" });
    return;
  }

  res.status(403).json({ error: "Not authorized to access this client's data" });
});

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(coachRouter);
router.use(profileRouter);
router.use(planRouter);
router.use(goalsRouter);
router.use(foodsRouter);
router.use(mealsRouter);
router.use(mealPlanRouter);
router.use(shoppingListRouter);
router.use(workoutsRouter);
router.use(workoutPlanRouter);
router.use(dashboardRouter);
router.use(progressRouter);
router.use(logsRouter);
router.use(publicRouter);
router.use(storageRouter);

export default router;
