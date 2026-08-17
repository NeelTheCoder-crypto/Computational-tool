import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import optionsRouter from "./options.js";
import formulationRouter from "./formulation.js";
import statsRouter from "./stats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(optionsRouter);
router.use(formulationRouter);
router.use(statsRouter);

export default router;
