import { Router, type IRouter } from "express";
import {
  listFormulations,
  listMaterials,
  listPapers,
  listOutcomes,
  getFormulationDetail,
} from "../lib/supabaseQueries.js";

const router: IRouter = Router();

function parsePaging(query: Record<string, unknown>): {
  search: string | undefined;
  page: number | undefined;
  pageSize: number | undefined;
} {
  const search = typeof query["search"] === "string" ? (query["search"] as string) : undefined;
  const pageRaw = query["page"];
  const sizeRaw = query["page_size"];
  const page = pageRaw != null ? Number(pageRaw) : undefined;
  const pageSize = sizeRaw != null ? Number(sizeRaw) : undefined;
  return {
    search,
    page: page != null && Number.isFinite(page) ? page : undefined,
    pageSize: pageSize != null && Number.isFinite(pageSize) ? pageSize : undefined,
  };
}

router.get("/formulations", async (req, res): Promise<void> => {
  const { search, page, pageSize } = parsePaging(req.query as Record<string, unknown>);
  const result = await listFormulations(search, { page, pageSize });
  req.log.info({ total: result.total, returned: result.items.length }, "Formulations listed");
  res.json(result);
});

router.get("/formulations/:formulationId", async (req, res): Promise<void> => {
  const id = String(req.params["formulationId"] ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "formulationId is required" });
    return;
  }
  const detail = await getFormulationDetail(id);
  if (!detail) {
    res.status(404).json({ error: `Formulation ${id} not found` });
    return;
  }
  res.json(detail);
});

router.get("/materials", async (req, res): Promise<void> => {
  const { search, page, pageSize } = parsePaging(req.query as Record<string, unknown>);
  const result = await listMaterials(search, { page, pageSize });
  req.log.info({ total: result.total, returned: result.items.length }, "Materials listed");
  res.json(result);
});

router.get("/papers", async (req, res): Promise<void> => {
  const { search, page, pageSize } = parsePaging(req.query as Record<string, unknown>);
  const result = await listPapers(search, { page, pageSize });
  req.log.info({ total: result.total, returned: result.items.length }, "Papers listed");
  res.json(result);
});

router.get("/outcomes", async (req, res): Promise<void> => {
  const { search, page, pageSize } = parsePaging(req.query as Record<string, unknown>);
  const result = await listOutcomes(search, { page, pageSize });
  req.log.info({ total: result.total, returned: result.items.length }, "Outcomes listed");
  res.json(result);
});

export default router;
