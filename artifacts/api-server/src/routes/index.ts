import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import fragranceRouter from "./fragrance";
import weatherRouter from "./weather";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(fragranceRouter);
router.use(weatherRouter);
router.use(profileRouter);

export default router;
