import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import sheetRouter from "./sheet.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sheetRouter);

export default router;
