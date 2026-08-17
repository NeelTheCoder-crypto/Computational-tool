import { Router, type IRouter } from "express";
import {
  getDiseases,
  getRoutes,
  getRoutesForDisease,
  getFormulationsForDiseaseRoute,
} from "../lib/supabaseQueries.js";

const router: IRouter = Router();

router.get("/options/diseases", async (req, res): Promise<void> => {
  const values = await getDiseases();
  res.json({ values });
});

router.get("/options/routes", async (req, res): Promise<void> => {
  const disease = req.query["disease"] as string | undefined;
  const values = disease
    ? await getRoutesForDisease(disease)
    : await getRoutes();
  res.json({ values });
});

router.get("/options/formulations", async (req, res): Promise<void> => {
  const disease = req.query["disease"] as string | undefined;
  const route = req.query["route"] as string | undefined;

  if (!disease || !route) {
    res.status(400).json({ error: "disease and route query params are required" });
    return;
  }

  const formulations = await getFormulationsForDiseaseRoute(disease, route);
  res.json({ formulations });
});

export default router;
