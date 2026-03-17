import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import planRouter from "./plan";
import goalsRouter from "./goals";
import foodsRouter from "./foods";
import mealsRouter from "./meals";
import mealPlanRouter from "./meal-plan";
import shoppingListRouter from "./shopping-list";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(planRouter);
router.use(goalsRouter);
router.use(foodsRouter);
router.use(mealsRouter);
router.use(mealPlanRouter);
router.use(shoppingListRouter);

export default router;
