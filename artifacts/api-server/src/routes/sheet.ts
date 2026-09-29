import { Router, type IRouter } from "express";
import { getSheetCatalog } from "../lib/carrierSheet.js";

const router: IRouter = Router();

router.get("/sheet", async (req, res): Promise<void> => {
  try {
    const catalog = await getSheetCatalog();
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(catalog);
  } catch (error) {
    req.log.error({ err: error }, "Google carrier sheet unavailable");
    res.status(503).json({ error: "The Google Sheet is unavailable or its columns changed. No carrier results can be shown." });
  }
});

export default router;