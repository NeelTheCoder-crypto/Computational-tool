import { Router, type IRouter } from "express";
import { getFormulationById } from "../lib/supabaseQueries.js";

const router: IRouter = Router();

router.get("/formulation/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const detail = await getFormulationById(id);

  if (!detail) {
    res.status(404).json({ error: "Formulation not found" });
    return;
  }

  res.json(detail);
});

export default router;
