/**
 * Supabase retrieval layer for the NANP Carrier Selection Platform.
 *
 * This module is a schema-correct, genuinely filterable window onto the
 * pulmonary/mucosal nucleic-acid delivery database. It exposes:
 *   - carrier matching + ranking (matchCarriers) driven by the real join path
 *   - paged, searchable browse lists (formulations, materials, papers, outcomes)
 *   - a single-formulation detail assembler
 *   - filter options and database statistics
 *
 * All primary keys in this database are UUID strings.
 *
 * The join path that resolves a filter combination to carriers:
 *   cargo type  -> formulation_cargos -> cargos.cargo_type
 *   route       -> experimental_arms.administration_route (arm's formulation_cargo
 *                  belongs to the formulation), with formulations.intended_route as fallback
 *   disease     -> experimental_arms -> experiments.model_id -> models.disease_model
 *
 * Every experimental arm ties a (formulation, cargo) pair to a route and, via its
 * experiment, to a disease model. Arms are therefore the strongest matching unit and
 * drive ranking; outcomes attached to an arm provide evidence strength.
 */

import { supabase } from "./supabase.js";
import {
  expandRoute,
  matchFormulationIds,
  type CarrierFilters,
  type Graph,
  type GraphArm,
  type FormulationMatchInfo,
} from "./carrierMatchingPure.js";

// Re-export types and pure functions so callers only need this module.
export { expandRoute, matchFormulationIds };
export type { CarrierFilters, Graph, GraphArm, FormulationMatchInfo };

// ---------------------------------------------------------------------------
// Filters & pagination
// ---------------------------------------------------------------------------

export interface Pagination {
  page?: number | undefined;
  pageSize?: number | undefined;
}

function normalizePagination(p?: Pagination): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(p?.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(p?.pageSize ?? 50)));
  return { page, pageSize };
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

export interface PaperSummary {
  paper_id: string;
  title: string | null;
  authors_text: string | null;
  journal: string | null;
  publication_year: number | null;
  doi: string | null;
  url: string | null;
  publication_type: string | null;
}

export interface CarrierMaterial {
  material_id: string;
  canonical_name: string | null;
  abbreviation: string | null;
  material_class: string | null;
  material_role: string | null;
}

export interface CarrierCargo {
  cargo_id: string;
  canonical_name: string | null;
  cargo_type: string | null;
  cargo_role: string | null;
}

export interface CarrierMatch {
  formulation_id: string;
  formulation_name: string | null;
  carrier_family: string | null;
  carrier_subtype: string | null;
  architecture: string | null;
  optimized_flag: boolean | null;
  intended_route: string | null;
  intended_mucosal_site: string | null;
  description: string | null;
  paper: PaperSummary | null;
  materials: CarrierMaterial[];
  cargos: CarrierCargo[];
  matched_cargo_types: string[];
  matched_routes: string[];
  matched_disease_models: string[];
  matching_arm_count: number;
  supporting_outcome_count: number;
  favorable_outcome_count: number;
  adverse_outcome_count: number;
  score: number;
}

export interface CarrierMatchResult {
  total: number;
  page: number;
  page_size: number;
  filters: CarrierFilters;
  items: CarrierMatch[];
}

// ---------------------------------------------------------------------------
// Relationship graph loader
//
// The dataset is small (<= a few hundred rows per table) so we load the
// relationship spine once and resolve filters/ranking in memory. This keeps the
// multi-hop join path (cargo/route/disease -> formulation) explicit and correct.
// ---------------------------------------------------------------------------


async function loadGraph(): Promise<Graph> {
  const [fcRes, formRes, armsRes, expRes, modelRes, outcomeRes] = await Promise.all([
    supabase
      .from("formulation_cargos")
      .select("formulation_cargo_id, formulation_id, cargos(cargo_type)"),
    supabase.from("formulations").select("formulation_id, intended_route"),
    supabase
      .from("experimental_arms")
      .select("arm_id, formulation_cargo_id, administration_route, experiment_id"),
    supabase.from("experiments").select("experiment_id, model_id"),
    supabase.from("models").select("model_id, disease_model"),
    supabase
      .from("biological_outcomes")
      .select("arm_id, result_polarity, direction_vs_comparator"),
  ]);

  // formulation_cargo_id -> { formulation_id, cargo_type }
  const fcById = new Map<string, { formulation_id: string; cargo_type: string | null }>();
  const cargoTypesByFormulation = new Map<string, Set<string>>();
  for (const row of fcRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cargoType = ((row as any).cargos?.cargo_type ?? null) as string | null;
    const fid = row.formulation_id as string;
    fcById.set(row.formulation_cargo_id as string, {
      formulation_id: fid,
      cargo_type: cargoType,
    });
    if (fid != null && cargoType) {
      if (!cargoTypesByFormulation.has(fid)) cargoTypesByFormulation.set(fid, new Set());
      cargoTypesByFormulation.get(fid)!.add(cargoType);
    }
  }

  const intendedRouteByFormulation = new Map<string, string | null>();
  for (const row of formRes.data ?? []) {
    intendedRouteByFormulation.set(
      row.formulation_id as string,
      (row.intended_route ?? null) as string | null
    );
  }

  const modelDisease = new Map<string, string | null>();
  for (const row of modelRes.data ?? []) {
    modelDisease.set(row.model_id as string, (row.disease_model ?? null) as string | null);
  }

  const expDisease = new Map<string, string | null>();
  for (const row of expRes.data ?? []) {
    const modelId = row.model_id as string | null;
    expDisease.set(
      row.experiment_id as string,
      modelId != null ? modelDisease.get(modelId) ?? null : null
    );
  }

  const armsByFormulation = new Map<string, GraphArm[]>();
  for (const row of armsRes.data ?? []) {
    const fc =
      row.formulation_cargo_id != null
        ? fcById.get(row.formulation_cargo_id as string)
        : undefined;
    const formulationId = fc?.formulation_id ?? null;
    const arm: GraphArm = {
      arm_id: row.arm_id as string,
      formulation_id: formulationId,
      cargo_type: fc?.cargo_type ?? null,
      route: (row.administration_route ?? null) as string | null,
      disease_model:
        row.experiment_id != null ? expDisease.get(row.experiment_id as string) ?? null : null,
    };
    if (formulationId != null) {
      if (!armsByFormulation.has(formulationId)) armsByFormulation.set(formulationId, []);
      armsByFormulation.get(formulationId)!.push(arm);
    }
  }

  const outcomeCountsByArm = new Map<
    string,
    { total: number; favorable: number; adverse: number }
  >();
  for (const row of outcomeRes.data ?? []) {
    const armId = row.arm_id as string | null;
    if (armId == null) continue;
    if (!outcomeCountsByArm.has(armId))
      outcomeCountsByArm.set(armId, { total: 0, favorable: 0, adverse: 0 });
    const entry = outcomeCountsByArm.get(armId)!;
    entry.total += 1;
    const polarity = (row.result_polarity ?? null) as string | null;
    const direction = (row.direction_vs_comparator ?? null) as string | null;
    if (polarity === "beneficial" || direction === "improved") entry.favorable += 1;
    if (polarity === "adverse" || direction === "reduced") entry.adverse += 1;
  }

  return {
    cargoTypesByFormulation,
    armsByFormulation,
    intendedRouteByFormulation,
    outcomeCountsByArm,
  };
}

// ---------------------------------------------------------------------------
// Carrier matching + ranking
// ---------------------------------------------------------------------------

/**
 * Match carriers (formulations) to a cargo/disease/route filter combination and
 * rank them by strength of database support. Never returns the whole table when
 * filters are set; an empty filter returns all formulations (paged).
 */
export async function matchCarriers(
  filters: CarrierFilters,
  pagination?: Pagination
): Promise<CarrierMatchResult> {
  const { page, pageSize } = normalizePagination(pagination);
  const graph = await loadGraph();
  const matched = matchFormulationIds(graph, filters);

  // Compute ranking signals per matched formulation.
  interface Ranked {
    formulation_id: string;
    matchingArmCount: number;
    supportingOutcomes: number;
    favorableOutcomes: number;
    adverseOutcomes: number;
    matchedCargoTypes: string[];
    matchedRoutes: string[];
    matchedDiseaseModels: string[];
    score: number;
  }

  const ranked: Ranked[] = [];
  for (const [fid, info] of matched) {
    let supporting = 0;
    let favorable = 0;
    let adverse = 0;
    // Count outcomes on the matching arms when filters are active.
    // When no filter was set (browse mode), use all arms. Never fall back to
    // unrelated arms for a filtered query — that would count evidence for other
    // cargo/route/disease combinations and mislead the ranking.
    const hasFilters = !!(filters.cargoType || filters.disease || filters.route);
    const armsForEvidence = hasFilters
      ? info.matchingArms
      : graph.armsByFormulation.get(fid) ?? [];
    for (const arm of armsForEvidence) {
      const c = graph.outcomeCountsByArm.get(arm.arm_id);
      if (c) {
        supporting += c.total;
        favorable += c.favorable;
        adverse += c.adverse;
      }
    }
    // Score: matching arms dominate, favorable outcomes reinforce, adverse penalize.
    const score =
      info.matchingArms.length * 10 + favorable * 3 + supporting * 1 - adverse * 2;
    ranked.push({
      formulation_id: fid,
      matchingArmCount: info.matchingArms.length,
      supportingOutcomes: supporting,
      favorableOutcomes: favorable,
      adverseOutcomes: adverse,
      matchedCargoTypes: [...info.matchedCargoTypes].sort(),
      matchedRoutes: [...info.matchedRoutes].sort(),
      matchedDiseaseModels: [...info.matchedDiseaseModels].sort(),
      score,
    });
  }

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.matchingArmCount - a.matchingArmCount ||
      b.favorableOutcomes - a.favorableOutcomes ||
      a.formulation_id.localeCompare(b.formulation_id)
  );

  const total = ranked.length;
  const start = (page - 1) * pageSize;
  const pageRanked = ranked.slice(start, start + pageSize);
  const pageIds = pageRanked.map((r) => r.formulation_id);

  // Hydrate the page with full formulation detail (paper, materials, cargos).
  const detailsById = await hydrateFormulations(pageIds);

  const items: CarrierMatch[] = pageRanked.map((r) => {
    const d = detailsById.get(r.formulation_id);
    return {
      formulation_id: r.formulation_id,
      formulation_name: d?.formulation_name ?? null,
      carrier_family: d?.carrier_family ?? null,
      carrier_subtype: d?.carrier_subtype ?? null,
      architecture: d?.architecture ?? null,
      optimized_flag: d?.optimized_flag ?? null,
      intended_route: d?.intended_route ?? null,
      intended_mucosal_site: d?.intended_mucosal_site ?? null,
      description: d?.description ?? null,
      paper: d?.paper ?? null,
      materials: d?.materials ?? [],
      cargos: d?.cargos ?? [],
      matched_cargo_types: r.matchedCargoTypes,
      matched_routes: r.matchedRoutes,
      matched_disease_models: r.matchedDiseaseModels,
      matching_arm_count: r.matchingArmCount,
      supporting_outcome_count: r.supportingOutcomes,
      favorable_outcome_count: r.favorableOutcomes,
      adverse_outcome_count: r.adverseOutcomes,
      score: r.score,
    };
  });

  return { total, page, page_size: pageSize, filters, items };
}

// ---------------------------------------------------------------------------
// Formulation hydration (materials, cargos, paper) for a set of IDs
// ---------------------------------------------------------------------------

interface HydratedFormulation {
  formulation_id: string;
  formulation_name: string | null;
  carrier_family: string | null;
  carrier_subtype: string | null;
  architecture: string | null;
  optimized_flag: boolean | null;
  intended_route: string | null;
  intended_mucosal_site: string | null;
  description: string | null;
  paper: PaperSummary | null;
  materials: CarrierMaterial[];
  cargos: CarrierCargo[];
}

async function hydrateFormulations(
  ids: string[]
): Promise<Map<string, HydratedFormulation>> {
  const out = new Map<string, HydratedFormulation>();
  if (ids.length === 0) return out;

  const [formRes, matRes, cargoRes] = await Promise.all([
    supabase
      .from("formulations")
      .select(
        `formulation_id, formulation_name, carrier_family, carrier_subtype, architecture,
         optimized_flag, intended_route, intended_mucosal_site, formulation_description_raw,
         papers(paper_id, title, authors_text, journal, publication_year, doi, url, publication_type)`
      )
      .in("formulation_id", ids),
    supabase
      .from("formulation_materials")
      .select(
        "formulation_id, material_role, materials(material_id, canonical_name, abbreviation, material_class)"
      )
      .in("formulation_id", ids),
    supabase
      .from("formulation_cargos")
      .select("formulation_id, cargo_role, cargos(cargo_id, canonical_name, cargo_type)")
      .in("formulation_id", ids),
  ]);

  const materialsByForm = new Map<string, CarrierMaterial[]>();
  for (const row of matRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (row as any).materials;
    if (!m) continue;
    const fid = row.formulation_id as string;
    if (!materialsByForm.has(fid)) materialsByForm.set(fid, []);
    materialsByForm.get(fid)!.push({
      material_id: m.material_id,
      canonical_name: m.canonical_name ?? null,
      abbreviation: m.abbreviation ?? null,
      material_class: m.material_class ?? null,
      material_role: (row.material_role ?? null) as string | null,
    });
  }

  const cargosByForm = new Map<string, CarrierCargo[]>();
  for (const row of cargoRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (row as any).cargos;
    if (!c) continue;
    const fid = row.formulation_id as string;
    if (!cargosByForm.has(fid)) cargosByForm.set(fid, []);
    cargosByForm.get(fid)!.push({
      cargo_id: c.cargo_id,
      canonical_name: c.canonical_name ?? null,
      cargo_type: c.cargo_type ?? null,
      cargo_role: (row.cargo_role ?? null) as string | null,
    });
  }

  for (const row of formRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (row as any).papers;
    const fid = row.formulation_id as string;
    out.set(fid, {
      formulation_id: fid,
      formulation_name: (row.formulation_name ?? null) as string | null,
      carrier_family: (row.carrier_family ?? null) as string | null,
      carrier_subtype: (row.carrier_subtype ?? null) as string | null,
      architecture: (row.architecture ?? null) as string | null,
      optimized_flag: (row.optimized_flag ?? null) as boolean | null,
      intended_route: (row.intended_route ?? null) as string | null,
      intended_mucosal_site: (row.intended_mucosal_site ?? null) as string | null,
      description: (row.formulation_description_raw ?? null) as string | null,
      paper: p
        ? {
            paper_id: p.paper_id,
            title: p.title ?? null,
            authors_text: p.authors_text ?? null,
            journal: p.journal ?? null,
            publication_year: p.publication_year ?? null,
            doi: p.doi ?? null,
            url: p.url ?? null,
            publication_type: p.publication_type ?? null,
          }
        : null,
      materials: materialsByForm.get(fid) ?? [],
      cargos: cargosByForm.get(fid) ?? [],
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Browse / list endpoints
// ---------------------------------------------------------------------------

export interface PagedResult<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface FormulationListItem {
  formulation_id: string;
  formulation_name: string | null;
  carrier_family: string | null;
  carrier_subtype: string | null;
  architecture: string | null;
  optimized_flag: boolean | null;
  intended_route: string | null;
  intended_mucosal_site: string | null;
  paper_id: string | null;
  paper_title: string | null;
  cargo_types: string[];
  material_names: string[];
  evidence_routes: string[];
  disease_models: string[];
  experimental_arm_count: number;
  disease_evidence_count: number;
  outcome_count: number;
  match_tier: "direct" | "partial" | "catalog";
  matched_filter_count: number;
  active_filter_count: number;
}

export type FormulationEvidenceFilter =
  | "with_arms"
  | "with_outcomes"
  | "disease_linked"
  | "no_disease_link";

export interface FormulationBrowseFilters {
  disease?: string | undefined;
  route?: string | undefined;
  cargoType?: string | undefined;
  material?: string | undefined;
  evidence?: FormulationEvidenceFilter | undefined;
}

export async function listFormulations(
  search?: string,
  pagination?: Pagination,
  filters: FormulationBrowseFilters = {}
): Promise<PagedResult<FormulationListItem>> {
  const { page, pageSize } = normalizePagination(pagination);
  let query = supabase
    .from("formulations")
    .select(
      `formulation_id, formulation_name, carrier_family, carrier_subtype, architecture,
       optimized_flag, intended_route, intended_mucosal_site, paper_id`,
      { count: "exact" }
    );
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(
      `formulation_name.ilike.${s},carrier_family.ilike.${s},carrier_subtype.ilike.${s},architecture.ilike.${s}`
    );
  }
  const hasRelationshipFilters = Boolean(
    filters.disease ||
      filters.route ||
      filters.cargoType ||
      filters.material ||
      filters.evidence
  );

  // Relationship filters are resolved from the same in-memory graph as carrier
  // matching. This intentionally starts from formulations, so a route-only
  // formulation is not lost just because its arms have no disease model.
  const { data: allData } = await query
    .order("formulation_name", { ascending: true, nullsFirst: false })
    .range(0, hasRelationshipFilters ? 9999 : 999);
  let rows = allData ?? [];

  const graph = await loadGraph();
  const rowIds = new Set(rows.map((row) => row.formulation_id as string));
  const activeRelationshipFilterCount = [
    filters.cargoType,
    filters.disease,
    filters.route,
  ].filter(Boolean).length;
  const relationshipRankById = new Map<
    string,
    {
      tier: "direct" | "partial" | "catalog";
      matchedFilterCount: number;
      score: number;
    }
  >();

  if (filters.disease || filters.route || filters.cargoType) {
    const directMatches = matchFormulationIds(graph, {
      disease: filters.disease,
      route: filters.route,
      cargoType: filters.cargoType,
    });
    const acceptedRoutes = filters.route ? expandRoute(filters.route) : null;

    for (const row of rows) {
      const id = row.formulation_id as string;
      const arms = graph.armsByFormulation.get(id) ?? [];
      const cargoTypes = graph.cargoTypesByFormulation.get(id) ?? new Set<string>();
      const intendedRoute = graph.intendedRouteByFormulation.get(id) ?? null;
      const cargoMatched = filters.cargoType
        ? cargoTypes.has(filters.cargoType)
        : false;
      const diseaseMatched = filters.disease
        ? arms.some((arm) => arm.disease_model === filters.disease)
        : false;
      const routeMatched = filters.route
        ? arms.some((arm) => arm.route != null && acceptedRoutes!.has(arm.route)) ||
          (intendedRoute != null && acceptedRoutes!.has(intendedRoute))
        : false;
      const matchedFilterCount = [cargoMatched, diseaseMatched, routeMatched].filter(
        Boolean
      ).length;
      const direct = directMatches.has(id);
      const tier = direct ? "direct" : matchedFilterCount > 0 ? "partial" : "catalog";
      const outcomeCount = arms.reduce(
        (totalOutcomes, arm) =>
          totalOutcomes + (graph.outcomeCountsByArm.get(arm.arm_id)?.total ?? 0),
        0
      );
      relationshipRankById.set(id, {
        tier,
        matchedFilterCount,
        score:
          (direct ? 10_000 : 0) +
          matchedFilterCount * 1_000 +
          arms.length * 10 +
          outcomeCount,
      });
    }

    // Carrier inputs organize the catalog rather than eliminating it. Exact
    // same-arm evidence is first, followed by independently related evidence,
    // then the remaining catalog records.
    rows.sort((a, b) => {
      const aRank = relationshipRankById.get(a.formulation_id as string);
      const bRank = relationshipRankById.get(b.formulation_id as string);
      return (
        (bRank?.score ?? 0) - (aRank?.score ?? 0) ||
        String(a.formulation_name ?? "").localeCompare(String(b.formulation_name ?? ""))
      );
    });
  }

  if (filters.material && rows.length > 0) {
    const { data: materialRows } = await supabase
      .from("formulation_materials")
      .select(
        "formulation_id, materials(material_id, canonical_name, abbreviation, material_class)"
      )
      .in("formulation_id", [...rowIds]);
    const needle = filters.material.trim().toLowerCase();
    const materialFormulationIds = new Set(
      (materialRows ?? [])
        .filter((row) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const material = (row as any).materials;
          return [material?.material_id, material?.canonical_name, material?.abbreviation, material?.material_class]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase() === needle);
        })
        .map((row) => row.formulation_id as string)
    );
    rows = rows.filter((row) => materialFormulationIds.has(row.formulation_id as string));
  }

  if (filters.evidence) {
    rows = rows.filter((row) => {
      const arms = graph.armsByFormulation.get(row.formulation_id as string) ?? [];
      const outcomes = arms.reduce(
        (total, arm) => total + (graph.outcomeCountsByArm.get(arm.arm_id)?.total ?? 0),
        0
      );
      const diseaseArms = arms.filter((arm) => Boolean(arm.disease_model)).length;
      switch (filters.evidence) {
        case "with_arms":
          return arms.length > 0;
        case "with_outcomes":
          return outcomes > 0;
        case "disease_linked":
          return diseaseArms > 0;
        case "no_disease_link":
          return diseaseArms === 0;
        default:
          return true;
      }
    });
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const detailsById = await hydrateFormulations(
    pageRows.map((row) => row.formulation_id as string)
  );

  return {
    total,
    page,
    page_size: pageSize,
    items: pageRows.map((r) => {
      const id = r.formulation_id as string;
      const detail = detailsById.get(id);
      const arms = graph.armsByFormulation.get(id) ?? [];
      const evidenceRoutes = new Set(
        arms.map((arm) => arm.route).filter((value): value is string => Boolean(value))
      );
      const diseaseModels = new Set(
        arms
          .map((arm) => arm.disease_model)
          .filter((value): value is string => Boolean(value))
      );
      const outcomeCount = arms.reduce(
        (totalOutcomes, arm) =>
          totalOutcomes + (graph.outcomeCountsByArm.get(arm.arm_id)?.total ?? 0),
        0
      );
      const relationshipRank = relationshipRankById.get(id);
      return {
      formulation_id: r.formulation_id as string,
      formulation_name: (r.formulation_name ?? null) as string | null,
      carrier_family: (r.carrier_family ?? null) as string | null,
      carrier_subtype: (r.carrier_subtype ?? null) as string | null,
      architecture: (r.architecture ?? null) as string | null,
      optimized_flag: (r.optimized_flag ?? null) as boolean | null,
      intended_route: (r.intended_route ?? null) as string | null,
      intended_mucosal_site: (r.intended_mucosal_site ?? null) as string | null,
      paper_id: (r.paper_id ?? null) as string | null,
      paper_title: detail?.paper?.title ?? null,
      cargo_types: (detail?.cargos ?? [])
        .map((cargo) => cargo.cargo_type)
        .filter((value): value is string => Boolean(value)),
      material_names: (detail?.materials ?? [])
        .map((material) => material.canonical_name ?? material.abbreviation)
        .filter((value): value is string => Boolean(value)),
      evidence_routes: [...evidenceRoutes].sort(),
      disease_models: [...diseaseModels].sort(),
      experimental_arm_count: arms.length,
      disease_evidence_count: diseaseModels.size,
      outcome_count: outcomeCount,
      match_tier: relationshipRank?.tier ?? "catalog",
      matched_filter_count: relationshipRank?.matchedFilterCount ?? 0,
      active_filter_count: activeRelationshipFilterCount,
      };
    }),
  };
}

export interface MaterialListItem {
  material_id: string;
  canonical_name: string | null;
  abbreviation: string | null;
  material_class: string | null;
  chemical_subclass: string | null;
  ionizable_flag: boolean | null;
  apparent_pka: number | null;
  molecular_weight_da: number | null;
}

export async function listMaterials(
  search?: string,
  pagination?: Pagination
): Promise<PagedResult<MaterialListItem>> {
  const { page, pageSize } = normalizePagination(pagination);
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("materials")
    .select(
      `material_id, canonical_name, abbreviation, material_class, chemical_subclass,
       ionizable_flag, apparent_pka, molecular_weight_da`,
      { count: "exact" }
    );
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(
      `canonical_name.ilike.${s},abbreviation.ilike.${s},material_class.ilike.${s},chemical_subclass.ilike.${s}`
    );
  }
  const { data, count } = await query
    .order("canonical_name", { ascending: true, nullsFirst: false })
    .range(from, from + pageSize - 1);

  return {
    total: count ?? 0,
    page,
    page_size: pageSize,
    items: (data ?? []).map((r) => ({
      material_id: r.material_id as string,
      canonical_name: (r.canonical_name ?? null) as string | null,
      abbreviation: (r.abbreviation ?? null) as string | null,
      material_class: (r.material_class ?? null) as string | null,
      chemical_subclass: (r.chemical_subclass ?? null) as string | null,
      ionizable_flag: (r.ionizable_flag ?? null) as boolean | null,
      apparent_pka: (r.apparent_pka ?? null) as number | null,
      molecular_weight_da: (r.molecular_weight_da ?? null) as number | null,
    })),
  };
}

export async function listPapers(
  search?: string,
  pagination?: Pagination
): Promise<PagedResult<PaperSummary>> {
  const { page, pageSize } = normalizePagination(pagination);
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("papers")
    .select(
      `paper_id, title, authors_text, journal, publication_year, doi, url, publication_type`,
      { count: "exact" }
    );
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`title.ilike.${s},authors_text.ilike.${s},journal.ilike.${s}`);
  }
  const { data, count } = await query
    .order("publication_year", { ascending: false, nullsFirst: false })
    .range(from, from + pageSize - 1);

  return {
    total: count ?? 0,
    page,
    page_size: pageSize,
    items: (data ?? []).map((r) => ({
      paper_id: r.paper_id as string,
      title: (r.title ?? null) as string | null,
      authors_text: (r.authors_text ?? null) as string | null,
      journal: (r.journal ?? null) as string | null,
      publication_year: (r.publication_year ?? null) as number | null,
      doi: (r.doi ?? null) as string | null,
      url: (r.url ?? null) as string | null,
      publication_type: (r.publication_type ?? null) as string | null,
    })),
  };
}

export interface OutcomeListItem {
  outcome_id: string;
  arm_id: string | null;
  outcome_domain: string | null;
  metric_code: string | null;
  target_tissue: string | null;
  value_numeric: number | null;
  value_operator: string | null;
  value_text: string | null;
  unit: string | null;
  direction_vs_comparator: string | null;
  result_polarity: string | null;
  fold_change: number | null;
  p_value: number | null;
  result_interpretation: string | null;
}

export async function listOutcomes(
  search?: string,
  pagination?: Pagination
): Promise<PagedResult<OutcomeListItem>> {
  const { page, pageSize } = normalizePagination(pagination);
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("biological_outcomes")
    .select(
      `outcome_id, arm_id, outcome_domain, metric_code, target_tissue, value_numeric,
       value_operator, value_text, unit, direction_vs_comparator, result_polarity,
       fold_change, p_value, result_interpretation`,
      { count: "exact" }
    );
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(
      `outcome_domain.ilike.${s},metric_code.ilike.${s},target_tissue.ilike.${s},result_interpretation.ilike.${s}`
    );
  }
  const { data, count } = await query
    .order("outcome_id", { ascending: true })
    .range(from, from + pageSize - 1);

  return {
    total: count ?? 0,
    page,
    page_size: pageSize,
    items: (data ?? []).map((r) => mapOutcome(r)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOutcome(o: any): OutcomeListItem {
  return {
    outcome_id: o.outcome_id as string,
    arm_id: (o.arm_id ?? null) as string | null,
    outcome_domain: (o.outcome_domain ?? null) as string | null,
    metric_code: (o.metric_code ?? null) as string | null,
    target_tissue: (o.target_tissue ?? null) as string | null,
    value_numeric: (o.value_numeric ?? null) as number | null,
    value_operator: (o.value_operator ?? null) as string | null,
    value_text: (o.value_text ?? null) as string | null,
    unit: (o.unit ?? null) as string | null,
    direction_vs_comparator: (o.direction_vs_comparator ?? null) as string | null,
    result_polarity: (o.result_polarity ?? null) as string | null,
    fold_change: (o.fold_change ?? null) as number | null,
    p_value: (o.p_value ?? null) as number | null,
    result_interpretation: (o.result_interpretation ?? null) as string | null,
  };
}

// ---------------------------------------------------------------------------
// Single-formulation detail assembler
// ---------------------------------------------------------------------------

export interface FormulationArmDetail {
  arm_id: string;
  experiment_id: string | null;
  arm_name: string | null;
  administration_route: string | null;
  administration_site: string | null;
  delivery_device: string | null;
  dose_value: number | null;
  dose_unit: string | null;
  number_of_doses: number | null;
  experiment_type: string | null;
  objective: string | null;
  disease_model: string | null;
  species: string | null;
  outcomes: OutcomeListItem[];
}

export interface FormulationMechanism {
  mechanism_id: string;
  experiment_id: string | null;
  mechanism_category: string | null;
  mechanism_statement: string | null;
  evidence_status: string | null;
  evidence_method: string | null;
  biological_level: string | null;
  source_text: string | null;
  source_location: string | null;
}

export interface FormulationLimitation {
  limitation_id: string;
  experiment_id: string | null;
  limitation_category: string | null;
  limitation_statement: string | null;
  scope: string | null;
  severity: string | null;
  author_reported: boolean | null;
  source_text: string | null;
  source_location: string | null;
}

export interface FormulationDetail extends HydratedFormulation {
  targeting: Array<{
    targeting_id: string;
    target_type: string | null;
    target_name: string | null;
    target_cell_type: string | null;
    targeting_strategy: string | null;
  }>;
  processes: Array<{
    process_id: string;
    process_stage: string | null;
    method: string | null;
    device: string | null;
  }>;
  physicochemical: Array<{
    measurement_id: string;
    metric_code: string | null;
    value_numeric: number | null;
    value_text: string | null;
    unit: string | null;
  }>;
  arms: FormulationArmDetail[];
  mechanisms: FormulationMechanism[];
  limitations: FormulationLimitation[];
}

export async function getFormulationDetail(
  formulationId: string
): Promise<FormulationDetail | null> {
  const hydrated = await hydrateFormulations([formulationId]);
  const base = hydrated.get(formulationId);
  if (!base) return null;

  const [targetingRes, processRes, physRes, fcRes] = await Promise.all([
    supabase
      .from("formulation_targeting")
      .select("targeting_id, target_type, target_name, target_cell_type, targeting_strategy")
      .eq("formulation_id", formulationId),
    supabase
      .from("formulation_processes")
      .select("process_id, process_stage, method, device")
      .eq("formulation_id", formulationId),
    supabase
      .from("physicochemical_measurements")
      .select("measurement_id, metric_code, value_numeric, value_text, unit")
      .eq("formulation_id", formulationId),
    supabase
      .from("formulation_cargos")
      .select("formulation_cargo_id")
      .eq("formulation_id", formulationId),
  ]);

  // Arms for this formulation are those whose formulation_cargo belongs to it.
  const fcIds = (fcRes.data ?? []).map((r) => r.formulation_cargo_id as string);
  let arms: FormulationArmDetail[] = [];
  let mechanisms: FormulationMechanism[] = [];
  let limitations: FormulationLimitation[] = [];
  if (fcIds.length > 0) {
    const { data: armData } = await supabase
      .from("experimental_arms")
      .select(
        `arm_id, experiment_id, arm_name, administration_route, administration_site, delivery_device,
         dose_value, dose_unit, number_of_doses,
         experiments(experiment_type, objective, models(disease_model, species))`
      )
      .in("formulation_cargo_id", fcIds);

    const armIds = (armData ?? []).map((a) => a.arm_id as string);
    const experimentIds = Array.from(
      new Set(
        (armData ?? [])
          .map((a) => a.experiment_id as string | null)
          .filter((value): value is string => Boolean(value))
      )
    );
    const outcomesByArm = new Map<string, OutcomeListItem[]>();
    const [outcomeRes, mechanismRes, limitationRes] = await Promise.all([
      armIds.length > 0
        ? supabase
            .from("biological_outcomes")
            .select(
              `outcome_id, arm_id, outcome_domain, metric_code, target_tissue, value_numeric,
               value_operator, value_text, unit, direction_vs_comparator, result_polarity,
               fold_change, p_value, result_interpretation`
            )
            .in("arm_id", armIds)
        : Promise.resolve({ data: [] }),
      experimentIds.length > 0
        ? supabase
            .from("mechanisms")
            .select(
              `mechanism_id, experiment_id, mechanism_category, mechanism_statement,
               evidence_status, evidence_method, biological_level, source_text, source_location`
            )
            .in("experiment_id", experimentIds)
        : Promise.resolve({ data: [] }),
      experimentIds.length > 0
        ? supabase
            .from("limitations")
            .select(
              `limitation_id, experiment_id, limitation_category, limitation_statement,
               scope, severity, author_reported, source_text, source_location`
            )
            .in("experiment_id", experimentIds)
        : Promise.resolve({ data: [] }),
    ]);
    {
      const outcomeData = outcomeRes.data;
      for (const o of outcomeData ?? []) {
        const armId = o.arm_id as string;
        if (!outcomesByArm.has(armId)) outcomesByArm.set(armId, []);
        outcomesByArm.get(armId)!.push(mapOutcome(o));
      }
    }
    mechanisms = (mechanismRes.data ?? []).map((m) => ({
      mechanism_id: m.mechanism_id as string,
      experiment_id: (m.experiment_id ?? null) as string | null,
      mechanism_category: (m.mechanism_category ?? null) as string | null,
      mechanism_statement: (m.mechanism_statement ?? null) as string | null,
      evidence_status: (m.evidence_status ?? null) as string | null,
      evidence_method: (m.evidence_method ?? null) as string | null,
      biological_level: (m.biological_level ?? null) as string | null,
      source_text: (m.source_text ?? null) as string | null,
      source_location: (m.source_location ?? null) as string | null,
    }));
    limitations = (limitationRes.data ?? []).map((l) => ({
      limitation_id: l.limitation_id as string,
      experiment_id: (l.experiment_id ?? null) as string | null,
      limitation_category: (l.limitation_category ?? null) as string | null,
      limitation_statement: (l.limitation_statement ?? null) as string | null,
      scope: (l.scope ?? null) as string | null,
      severity: (l.severity ?? null) as string | null,
      author_reported: (l.author_reported ?? null) as boolean | null,
      source_text: (l.source_text ?? null) as string | null,
      source_location: (l.source_location ?? null) as string | null,
    }));

    arms = (armData ?? []).map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exp = (a as any).experiments;
      const model = exp?.models;
      return {
        arm_id: a.arm_id as string,
        experiment_id: (a.experiment_id ?? null) as string | null,
        arm_name: (a.arm_name ?? null) as string | null,
        administration_route: (a.administration_route ?? null) as string | null,
        administration_site: (a.administration_site ?? null) as string | null,
        delivery_device: (a.delivery_device ?? null) as string | null,
        dose_value: (a.dose_value ?? null) as number | null,
        dose_unit: (a.dose_unit ?? null) as string | null,
        number_of_doses: (a.number_of_doses ?? null) as number | null,
        experiment_type: exp?.experiment_type ?? null,
        objective: exp?.objective ?? null,
        disease_model: model?.disease_model ?? null,
        species: model?.species ?? null,
        outcomes: outcomesByArm.get(a.arm_id as string) ?? [],
      };
    });
  }

  return {
    ...base,
    targeting: (targetingRes.data ?? []).map((t) => ({
      targeting_id: t.targeting_id as string,
      target_type: (t.target_type ?? null) as string | null,
      target_name: (t.target_name ?? null) as string | null,
      target_cell_type: (t.target_cell_type ?? null) as string | null,
      targeting_strategy: (t.targeting_strategy ?? null) as string | null,
    })),
    processes: (processRes.data ?? []).map((p) => ({
      process_id: p.process_id as string,
      process_stage: (p.process_stage ?? null) as string | null,
      method: (p.method ?? null) as string | null,
      device: (p.device ?? null) as string | null,
    })),
    physicochemical: (physRes.data ?? []).map((m) => ({
      measurement_id: m.measurement_id as string,
      metric_code: (m.metric_code ?? null) as string | null,
      value_numeric: (m.value_numeric ?? null) as number | null,
      value_text: (m.value_text ?? null) as string | null,
      unit: (m.unit ?? null) as string | null,
    })),
    arms,
    mechanisms,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Filter options & statistics
// ---------------------------------------------------------------------------

/** Distinct cargo / nucleic acid types from the cargos table */
export async function getCargos(): Promise<string[]> {
  const { data, error } = await supabase
    .from("cargos")
    .select("cargo_type")
    .not("cargo_type", "is", null);
  if (error || !data) return [];
  return Array.from(new Set(data.map((r) => r.cargo_type as string).filter(Boolean))).sort();
}

/** Distinct disease models from the models table */
export async function getDiseases(): Promise<string[]> {
  const { data, error } = await supabase
    .from("models")
    .select("disease_model")
    .not("disease_model", "is", null);
  if (error || !data) return [];
  return Array.from(
    new Set(data.map((r) => r.disease_model as string).filter(Boolean))
  ).sort();
}

/** Distinct routes of administration from experimental_arms and formulations */
export async function getRoutes(): Promise<string[]> {
  const [armsResult, formulationsResult] = await Promise.all([
    supabase
      .from("experimental_arms")
      .select("administration_route")
      .not("administration_route", "is", null),
    supabase
      .from("formulations")
      .select("intended_route")
      .not("intended_route", "is", null),
  ]);
  const routes = [
    ...(armsResult.data ?? []).map((r) => r.administration_route as string),
    ...(formulationsResult.data ?? []).map((r) => r.intended_route as string),
  ];
  return Array.from(new Set(routes.filter(Boolean))).sort();
}

/**
 * Routes that have ≥1 formulation matching the given disease.
 * Uses the same graph/matching logic as matchCarriers so the results are
 * guaranteed consistent — no route is offered that would return zero results.
 */
export async function getRoutesForDisease(disease: string): Promise<string[]> {
  const graph = await loadGraph();
  const matched = matchFormulationIds(graph, { disease });
  const routes = new Set<string>();
  for (const [, info] of matched) {
    for (const arm of info.matchingArms) {
      if (arm.route) routes.add(arm.route);
    }
  }
  return [...routes].sort();
}

export interface FilterOptions {
  cargo_types: string[];
  diseases: string[];
  routes: string[];
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const [cargo_types, diseases, routes] = await Promise.all([
    getCargos(),
    getDiseases(),
    getRoutes(),
  ]);
  return { cargo_types, diseases, routes };
}

/** Get database statistics */
export async function getDatabaseStatistics(): Promise<{
  total_papers: number;
  total_formulations: number;
  total_materials: number;
  total_experiments: number;
  total_biological_outcomes: number;
}> {
  const [papers, formulations, materials, experiments, outcomes] = await Promise.all([
    supabase.from("papers").select("*", { count: "exact", head: true }),
    supabase.from("formulations").select("*", { count: "exact", head: true }),
    supabase.from("materials").select("*", { count: "exact", head: true }),
    supabase.from("experiments").select("*", { count: "exact", head: true }),
    supabase.from("biological_outcomes").select("*", { count: "exact", head: true }),
  ]);

  return {
    total_papers: papers.count ?? 0,
    total_formulations: formulations.count ?? 0,
    total_materials: materials.count ?? 0,
    total_experiments: experiments.count ?? 0,
    total_biological_outcomes: outcomes.count ?? 0,
  };
}
