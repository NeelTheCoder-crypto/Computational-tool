import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import recommendRouter from "./recommend.js";
import optionsRouter from "./options.js";
import statsRouter from "./stats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(recommendRouter);
router.use(optionsRouter);
router.use(statsRouter);

export default router;
