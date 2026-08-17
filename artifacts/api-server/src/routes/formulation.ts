import { Router, type IRouter } from "express";
import { getFormulationDetail } from "../lib/supabaseQueries.js";

const router: IRouter = Router();

// Legacy /formulation/:id route — redirects to the new /formulations/:id detail endpoint.
router.get("/formulation/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const detail = await getFormulationDetail(id);

  if (!detail) {
    res.status(404).json({ error: "Formulation not found" });
    return;
  }

  res.json(detail);
});

export default router;
