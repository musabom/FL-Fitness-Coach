import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import planRouter from "./plan";
import goalsRouter from "./goals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(planRouter);
router.use(goalsRouter);

export default router;
