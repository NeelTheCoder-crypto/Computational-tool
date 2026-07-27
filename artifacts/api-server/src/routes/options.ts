import { Router, type IRouter } from "express";
import { getCargos, getDiseases, getRoutes } from "../lib/supabaseQueries.js";

const router: IRouter = Router();

router.get("/options/cargos", async (req, res): Promise<void> => {
  const values = await getCargos();
  req.log.info({ count: values.length }, "Cargo options retrieved");
  res.json({ values });
});

router.get("/options/diseases", async (req, res): Promise<void> => {
  const values = await getDiseases();
  req.log.info({ count: values.length }, "Disease options retrieved");
  res.json({ values });
});

router.get("/options/routes", async (req, res): Promise<void> => {
  const values = await getRoutes();
  req.log.info({ count: values.length }, "Route options retrieved");
  res.json({ values });
});

export default router;
