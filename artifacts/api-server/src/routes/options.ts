import { Router, type IRouter } from "express";
import { getDropdownOptions } from "../lib/supabaseQueries.js";

const router: IRouter = Router();

router.get("/options", async (req, res): Promise<void> => {
  const options = await getDropdownOptions();
  req.log.info(
    {
      nucleic_acids: options.nucleic_acids.length,
      diseases: options.diseases.length,
      routes: options.routes_of_administration.length,
    },
    "Options retrieved"
  );
  res.json(options);
});

export default router;
