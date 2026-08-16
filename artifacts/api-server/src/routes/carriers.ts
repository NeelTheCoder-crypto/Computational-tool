import { Router, type IRouter } from "express";
import { matchCarriers } from "../lib/supabaseQueries.js";
import { MatchCarriersBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/carriers/match", async (req, res): Promise<void> => {
  const parsed = MatchCarriersBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { cargo_type, disease, route, page, page_size } = parsed.data;

  const result = await matchCarriers(
    {
      cargoType: cargo_type ?? undefined,
      disease: disease ?? undefined,
      route: route ?? undefined,
    },
    { page: page ?? undefined, pageSize: page_size ?? undefined }
  );

  req.log.info(
    {
      cargo_type,
      disease,
      route,
      total: result.total,
      returned: result.items.length,
    },
    "Carrier match completed"
  );

  res.json(result);
});

export default router;
