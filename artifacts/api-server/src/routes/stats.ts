import { Router, type IRouter } from "express";
import { getDatabaseStatistics } from "../lib/supabaseQueries.js";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const stats = await getDatabaseStatistics();
  req.log.info(stats, "Database stats retrieved");
  res.json(stats);
});

export default router;
