import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import optionsRouter from "./options.js";
import formulationRouter from "./formulation.js";
import statsRouter from "./stats.js";
import carriersRouter from "./carriers.js";
import browseRouter from "./browse.js";
import recommendRouter from "./recommend.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(carriersRouter);
router.use(browseRouter);
router.use(recommendRouter);
router.use(optionsRouter);
router.use(statsRouter);
router.use(formulationRouter);

export default router;
