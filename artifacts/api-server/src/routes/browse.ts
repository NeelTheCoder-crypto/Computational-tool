import { Router, type IRouter } from "express";
import {
  listFormulations,
  listMaterials,
  listPapers,
  listOutcomes,
  getFormulationDetail,
  type FormulationEvidenceFilter,
} from "../lib/supabaseQueries.js";

const router: IRouter = Router();

function parsePaging(query: Record<string, unknown>): {
  search: string | undefined;
  page: number | undefined;
  pageSize: number | undefined;
  disease: string | undefined;
  route: string | undefined;
  cargoType: string | undefined;
  material: string | undefined;
  evidence: FormulationEvidenceFilter | undefined;
} {
  const search = typeof query["search"] === "string" ? (query["search"] as string) : undefined;
  const pageRaw = query["page"];
  const sizeRaw = query["page_size"];
  const page = pageRaw != null ? Number(pageRaw) : undefined;
  const pageSize = sizeRaw != null ? Number(sizeRaw) : undefined;
  const evidenceRaw = typeof query["evidence"] === "string" ? query["evidence"] : undefined;
  const evidence = ["with_arms", "with_outcomes", "disease_linked", "no_disease_link"].includes(
    evidenceRaw ?? ""
  )
    ? (evidenceRaw as FormulationEvidenceFilter)
    : undefined;
  return {
    search,
    page: page != null && Number.isFinite(page) ? page : undefined,
    pageSize: pageSize != null && Number.isFinite(pageSize) ? pageSize : undefined,
    disease: typeof query["disease"] === "string" ? query["disease"] : undefined,
    route: typeof query["route"] === "string" ? query["route"] : undefined,
    cargoType: typeof query["cargo_type"] === "string" ? query["cargo_type"] : undefined,
    material: typeof query["material"] === "string" ? query["material"] : undefined,
    evidence,
  };
}

router.get("/formulations", async (req, res): Promise<void> => {
  const { search, page, pageSize, disease, route, cargoType, material, evidence } = parsePaging(
    req.query as Record<string, unknown>
  );
  const result = await listFormulations(search, { page, pageSize }, {
    disease,
    route,
    cargoType,
    material,
    evidence,
  });
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
