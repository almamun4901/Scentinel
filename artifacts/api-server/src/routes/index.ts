import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import fragranceRouter from "./fragrance";
import weatherRouter from "./weather";
import profileRouter from "./profile";
import chatRouter from "./chat";
import mcpRouter from "./mcp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(fragranceRouter);
router.use(weatherRouter);
router.use(profileRouter);
router.use(chatRouter);
router.use(mcpRouter);

export default router;
