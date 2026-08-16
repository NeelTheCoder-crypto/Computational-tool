import { Router, type IRouter } from "express";
import {
  getCargos,
  getDiseases,
  getRoutes,
  getFilterOptions,
} from "../lib/supabaseQueries.js";

const router: IRouter = Router();

/** Combined filter options: cargo types, diseases, routes */
router.get("/options", async (req, res): Promise<void> => {
  const options = await getFilterOptions();
  res.json(options);
});

router.get("/options/cargos", async (req, res): Promise<void> => {
  const values = await getCargos();
  res.json({ values });
});

router.get("/options/diseases", async (req, res): Promise<void> => {
  const values = await getDiseases();
  res.json({ values });
});

router.get("/options/routes", async (req, res): Promise<void> => {
  const values = await getRoutes();
  res.json({ values });
});

export default router;
