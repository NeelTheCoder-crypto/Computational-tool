/**
 * Supabase retrieval functions for the NANP Carrier Selection Platform.
 * Column names match the actual DB schema discovered via the REST API.
 * The LLM never touches the DB — all evidence is retrieved here first.
 */

import { supabase } from "./supabase.js";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface FormulationRecord {
  id: string;
  name: string | null;
  description: string | null;
  carrier_family: string | null;
  carrier_subtype: string | null;
  intended_route: string | null;
  paper_id: string | null;
  cargo_types: string[];
  material_names: string[];
  targeting_strategies: string[];
  processes: string[];
}

export interface MaterialRecord {
  id: string;
  name: string | null;
  material_class: string | null;
  notes: string | null;
}

export interface OutcomeRecord {
  outcome_domain: string | null;
  metric_code: string | null;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  direction: string | null;
  polarity: string | null;
  interpretation: string | null;
  formulation_name: string | null;
}

export interface MechanismRecord {
  category: string | null;
  statement: string | null;
  formulation_name: string | null;
}

export interface LimitationRecord {
  category: string | null;
  statement: string | null;
  formulation_name: string | null;
}

export interface PaperRecord {
  id: string;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
}

export interface PhysicochemicalRecord {
  metric_code: string | null;
  condition_code: string | null;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  formulation_name: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find formulation IDs that carry the given nucleic acid cargo type */
async function formulationIdsForCargo(cargoType: string): Promise<string[]> {
  const { data: cargos } = await supabase
    .from("cargos")
    .select("cargo_id")
    .eq("cargo_type", cargoType);

  if (!cargos?.length) return [];

  const { data: links } = await supabase
    .from("formulation_cargos")
    .select("formulation_id")
    .in("cargo_id", cargos.map((c) => c.cargo_id));

  return [...new Set((links ?? []).map((l) => l.formulation_id))];
}

// ── Evidence retrieval ────────────────────────────────────────────────────────

/**
 * Retrieve formulations associated with the given nucleic acid cargo type.
 * Returns all matching formulations with their materials, cargos, targeting,
 * and process details assembled from the junction tables.
 */
export async function getFormulations(nucleicAcid: string): Promise<FormulationRecord[]> {
  const formulationIds = await formulationIdsForCargo(nucleicAcid);
  if (!formulationIds.length) return [];

  const { data: formulations, error } = await supabase
    .from("formulations")
    .select(
      "formulation_id, formulation_name, formulation_description_raw, carrier_family, carrier_subtype, intended_route, paper_id"
    )
    .in("formulation_id", formulationIds);

  if (error || !formulations?.length) return [];

  // Enrich with junction table data in parallel
  const ids = formulations.map((f) => f.formulation_id);

  const [fmData, fcData, ftData, fpData] = await Promise.all([
    supabase
      .from("formulation_materials")
      .select("formulation_id, materials(canonical_name)")
      .in("formulation_id", ids),
    supabase
      .from("formulation_cargos")
      .select("formulation_id, cargos(cargo_type)")
      .in("formulation_id", ids),
    supabase
      .from("formulation_targeting")
      .select("formulation_id, targeting_strategy, target_name")
      .in("formulation_id", ids),
    supabase
      .from("formulation_processes")
      .select("formulation_id, process_stage, method")
      .in("formulation_id", ids),
  ]);

  return formulations.map((f) => ({
    id: f.formulation_id,
    name: f.formulation_name,
    description: f.formulation_description_raw,
    carrier_family: f.carrier_family,
    carrier_subtype: f.carrier_subtype,
    intended_route: f.intended_route,
    paper_id: f.paper_id,
    cargo_types: (fcData.data ?? [])
      .filter((fc) => fc.formulation_id === f.formulation_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((fc) => (fc.cargos as any)?.cargo_type)
      .filter(Boolean),
    material_names: (fmData.data ?? [])
      .filter((fm) => fm.formulation_id === f.formulation_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((fm) => (fm.materials as any)?.canonical_name)
      .filter(Boolean),
    targeting_strategies: (ftData.data ?? [])
      .filter((ft) => ft.formulation_id === f.formulation_id)
      .map((ft) => [ft.targeting_strategy, ft.target_name].filter(Boolean).join(" → "))
      .filter(Boolean) as string[],
    processes: (fpData.data ?? [])
      .filter((fp) => fp.formulation_id === f.formulation_id)
      .map((fp) => [fp.process_stage, fp.method].filter(Boolean).join(": "))
      .filter(Boolean) as string[],
  }));
}

/** Retrieve materials referenced across all formulations */
export async function getMaterials(formulationIds: string[]): Promise<MaterialRecord[]> {
  if (!formulationIds.length) return [];

  const { data: links } = await supabase
    .from("formulation_materials")
    .select("material_id")
    .in("formulation_id", formulationIds);

  if (!links?.length) return [];

  const matIds = [...new Set(links.map((l) => l.material_id))];

  const { data, error } = await supabase
    .from("materials")
    .select("material_id, canonical_name, material_class, material_notes")
    .in("material_id", matIds);

  if (error || !data) return [];

  return data.map((m) => ({
    id: m.material_id,
    name: m.canonical_name,
    material_class: m.material_class,
    notes: m.material_notes,
  }));
}

/** Retrieve biological outcomes for specific formulations */
export async function getOutcomes(formulationIds: string[]): Promise<OutcomeRecord[]> {
  if (!formulationIds.length) return [];

  // arm_id → experimental_arms.formulation_cargo_id → formulation_cargos.formulation_id
  const { data: fcLinks } = await supabase
    .from("formulation_cargos")
    .select("formulation_cargo_id, formulation_id")
    .in("formulation_id", formulationIds);

  if (!fcLinks?.length) return [];

  const fcIds = fcLinks.map((fc) => fc.formulation_cargo_id);

  const { data: arms } = await supabase
    .from("experimental_arms")
    .select("arm_id, formulation_cargo_id")
    .in("formulation_cargo_id", fcIds);

  if (!arms?.length) return [];

  const armIds = arms.map((a) => a.arm_id);

  // Build a map from arm_id → formulation_name
  const fcToFormulationId = Object.fromEntries(
    fcLinks.map((fc) => [fc.formulation_cargo_id, fc.formulation_id])
  );
  const armToFcId = Object.fromEntries(
    arms.map((a) => [a.arm_id, a.formulation_cargo_id])
  );

  // Get formulation names
  const { data: formulations } = await supabase
    .from("formulations")
    .select("formulation_id, formulation_name")
    .in("formulation_id", formulationIds);

  const formulationNameById = Object.fromEntries(
    (formulations ?? []).map((f) => [f.formulation_id, f.formulation_name])
  );

  const { data: outcomes, error } = await supabase
    .from("biological_outcomes")
    .select(
      "arm_id, outcome_domain, metric_code, value_numeric, value_text, unit, direction_vs_comparator, result_polarity, result_interpretation"
    )
    .in("arm_id", armIds)
    .limit(300);

  if (error || !outcomes) return [];

  return outcomes.map((o) => {
    const fcId = armToFcId[o.arm_id];
    const formulationId = fcToFormulationId[fcId];
    return {
      outcome_domain: o.outcome_domain,
      metric_code: o.metric_code,
      value_numeric: o.value_numeric,
      value_text: o.value_text,
      unit: o.unit,
      direction: o.direction_vs_comparator,
      polarity: o.result_polarity,
      interpretation: o.result_interpretation,
      formulation_name: formulationNameById[formulationId] ?? null,
    };
  });
}

/** Retrieve delivery mechanisms for specific formulations */
export async function getMechanisms(formulationIds: string[]): Promise<MechanismRecord[]> {
  if (!formulationIds.length) return [];

  const { data, error } = await supabase
    .from("mechanisms")
    .select("mechanism_category, mechanism_statement, formulation_id")
    .in("formulation_id", formulationIds)
    .limit(200);

  if (error || !data) return [];

  const { data: formulations } = await supabase
    .from("formulations")
    .select("formulation_id, formulation_name")
    .in("formulation_id", formulationIds);

  const nameById = Object.fromEntries(
    (formulations ?? []).map((f) => [f.formulation_id, f.formulation_name])
  );

  return data.map((m) => ({
    category: m.mechanism_category,
    statement: m.mechanism_statement,
    formulation_name: nameById[m.formulation_id] ?? null,
  }));
}

/** Retrieve known limitations for specific formulations */
export async function getLimitations(formulationIds: string[]): Promise<LimitationRecord[]> {
  if (!formulationIds.length) return [];

  const { data, error } = await supabase
    .from("limitations")
    .select("limitation_category, limitation_statement, formulation_id")
    .in("formulation_id", formulationIds)
    .limit(200);

  if (error || !data) return [];

  const { data: formulations } = await supabase
    .from("formulations")
    .select("formulation_id, formulation_name")
    .in("formulation_id", formulationIds);

  const nameById = Object.fromEntries(
    (formulations ?? []).map((f) => [f.formulation_id, f.formulation_name])
  );

  return data.map((l) => ({
    category: l.limitation_category,
    statement: l.limitation_statement,
    formulation_name: nameById[l.formulation_id] ?? null,
  }));
}

/** Retrieve supporting papers by paper IDs */
export async function getSupportingPapers(paperIds: string[]): Promise<PaperRecord[]> {
  if (!paperIds.length) return [];

  const { data, error } = await supabase
    .from("papers")
    .select("paper_id, title, authors_text, journal, publication_year, doi")
    .in("paper_id", paperIds);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.paper_id,
    title: p.title,
    authors: p.authors_text,
    journal: p.journal,
    year: p.publication_year,
    doi: p.doi,
  }));
}

/** Retrieve physicochemical measurements for specific formulations */
export async function getPhysicochemicalMeasurements(
  formulationIds: string[]
): Promise<PhysicochemicalRecord[]> {
  if (!formulationIds.length) return [];

  const { data, error } = await supabase
    .from("physicochemical_measurements")
    .select(
      "formulation_id, metric_code, condition_code, value_numeric, value_text, unit"
    )
    .in("formulation_id", formulationIds)
    .limit(300);

  if (error || !data) return [];

  const { data: formulations } = await supabase
    .from("formulations")
    .select("formulation_id, formulation_name")
    .in("formulation_id", formulationIds);

  const nameById = Object.fromEntries(
    (formulations ?? []).map((f) => [f.formulation_id, f.formulation_name])
  );

  return data.map((p) => ({
    metric_code: p.metric_code,
    condition_code: p.condition_code,
    value_numeric: p.value_numeric,
    value_text: p.value_text,
    unit: p.unit,
    formulation_name: nameById[p.formulation_id] ?? null,
  }));
}

// ── Cascading explorer queries ────────────────────────────────────────────────

export interface FormulationSummaryRecord {
  id: string;
  name: string;
  carrier_family: string | null;
  carrier_subtype: string | null;
}

export interface FormulationDetailRecord {
  id: string;
  name: string;
  carrier_family: string | null;
  carrier_subtype: string | null;
  description: string | null;
  materials: string[];
  advantages: string[];
  limitations: string[];
  mechanisms: string[];
  papers: Array<{
    title: string | null;
    authors: string | null;
    journal: string | null;
    year: number | null;
    doi: string | null;
  }>;
}

/** Routes that have experimental evidence for the given disease model.
 *  Only returns routes where at least one arm also has a formulation linked
 *  (formulation_cargo_id IS NOT NULL), so every route shown leads to results. */
export async function getRoutesForDisease(disease: string): Promise<string[]> {
  const { data: models } = await supabase
    .from("models")
    .select("model_id")
    .eq("disease_model", disease);

  if (!models?.length) return [];

  const { data: experiments } = await supabase
    .from("experiments")
    .select("experiment_id")
    .in("model_id", models.map((m) => m.model_id));

  if (!experiments?.length) return [];

  // Require formulation_cargo_id to be non-null so only routes that
  // produce formulations are shown (avoids dead-end route selections).
  const { data: arms } = await supabase
    .from("experimental_arms")
    .select("administration_route")
    .in("experiment_id", experiments.map((e) => e.experiment_id))
    .not("administration_route", "is", null)
    .not("formulation_cargo_id", "is", null);

  return Array.from(
    new Set((arms ?? []).map((a) => a.administration_route as string).filter(Boolean))
  ).sort();
}

/** Formulations studied for a specific disease model and route of administration */
export async function getFormulationsForDiseaseRoute(
  disease: string,
  route: string
): Promise<FormulationSummaryRecord[]> {
  const { data: models } = await supabase
    .from("models")
    .select("model_id")
    .eq("disease_model", disease);

  if (!models?.length) return [];

  const { data: experiments } = await supabase
    .from("experiments")
    .select("experiment_id")
    .in("model_id", models.map((m) => m.model_id));

  if (!experiments?.length) return [];

  const { data: arms } = await supabase
    .from("experimental_arms")
    .select("formulation_cargo_id")
    .in("experiment_id", experiments.map((e) => e.experiment_id))
    .eq("administration_route", route)
    .not("formulation_cargo_id", "is", null);

  if (!arms?.length) return [];

  const fcIds = [...new Set(arms.map((a) => a.formulation_cargo_id))];

  const { data: fcs } = await supabase
    .from("formulation_cargos")
    .select("formulation_id")
    .in("formulation_cargo_id", fcIds);

  if (!fcs?.length) return [];

  const formulationIds = [...new Set(fcs.map((fc) => fc.formulation_id))];

  const { data: formulations } = await supabase
    .from("formulations")
    .select("formulation_id, formulation_name, carrier_family, carrier_subtype")
    .in("formulation_id", formulationIds)
    .order("formulation_name");

  return (formulations ?? []).map((f) => ({
    id: f.formulation_id,
    name: f.formulation_name ?? "Unnamed",
    carrier_family: f.carrier_family,
    carrier_subtype: f.carrier_subtype,
  }));
}

/** Full detail for one formulation: advantages, limitations, mechanisms, materials, papers */
export async function getFormulationById(
  id: string
): Promise<FormulationDetailRecord | null> {
  const { data: f } = await supabase
    .from("formulations")
    .select(
      "formulation_id, formulation_name, carrier_family, carrier_subtype, formulation_description_raw, paper_id"
    )
    .eq("formulation_id", id)
    .single();

  if (!f) return null;

  // Find arm_ids via formulation_cargos
  const { data: fcLinks } = await supabase
    .from("formulation_cargos")
    .select("formulation_cargo_id")
    .eq("formulation_id", id);

  const fcIds = (fcLinks ?? []).map((fc) => fc.formulation_cargo_id);

  const [materialsData, mechanismsData, limitationsData, armsData, paperData] =
    await Promise.all([
      supabase
        .from("formulation_materials")
        .select("materials(canonical_name)")
        .eq("formulation_id", id),
      supabase
        .from("mechanisms")
        .select("mechanism_statement")
        .eq("formulation_id", id),
      supabase
        .from("limitations")
        .select("limitation_statement")
        .eq("formulation_id", id),
      fcIds.length > 0
        ? supabase
            .from("experimental_arms")
            .select("arm_id")
            .in("formulation_cargo_id", fcIds)
        : Promise.resolve({ data: [] as { arm_id: string }[] }),
      f.paper_id
        ? supabase
            .from("papers")
            .select("title, authors_text, journal, publication_year, doi")
            .eq("paper_id", f.paper_id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

  const armIds = (armsData.data ?? []).map((a) => a.arm_id);

  const outcomesData =
    armIds.length > 0
      ? await supabase
          .from("biological_outcomes")
          .select(
            "result_interpretation, value_text, result_polarity, direction_vs_comparator"
          )
          .in("arm_id", armIds)
      : { data: [] as Array<{
          result_interpretation: string | null;
          value_text: string | null;
          result_polarity: string | null;
          direction_vs_comparator: string | null;
        }> };

  const mechanismStatements = (mechanismsData.data ?? [])
    .map((m) => m.mechanism_statement)
    .filter(Boolean) as string[];

  const advantageOutcomes = (outcomesData.data ?? [])
    .filter(
      (o) =>
        o.result_polarity === "beneficial" ||
        o.direction_vs_comparator === "improved"
    )
    .map((o) => o.result_interpretation ?? o.value_text)
    .filter(Boolean) as string[];

  const paper = paperData.data;

  return {
    id: f.formulation_id,
    name: f.formulation_name ?? "Unnamed",
    carrier_family: f.carrier_family,
    carrier_subtype: f.carrier_subtype,
    description: f.formulation_description_raw,
    materials: (materialsData.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m) => (m.materials as any)?.canonical_name)
      .filter(Boolean) as string[],
    advantages: [...new Set([...advantageOutcomes, ...mechanismStatements])],
    limitations: (limitationsData.data ?? [])
      .map((l) => l.limitation_statement)
      .filter(Boolean) as string[],
    mechanisms: mechanismStatements,
    papers: paper
      ? [
          {
            title: paper.title,
            authors: paper.authors_text,
            journal: paper.journal,
            year: paper.publication_year,
            doi: paper.doi,
          },
        ]
      : [],
  };
}

// ── Dropdown options ──────────────────────────────────────────────────────────

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
  return Array.from(new Set(data.map((r) => r.disease_model as string).filter(Boolean))).sort();
}

/** Distinct routes of administration from experimental_arms only.
 *  Using a single source keeps this consistent with getRoutesForDisease(),
 *  which also joins through experimental_arms. Including formulations.intended_route
 *  caused ghost routes that returned zero formulations. */
export async function getRoutes(): Promise<string[]> {
  const { data, error } = await supabase
    .from("experimental_arms")
    .select("administration_route")
    .not("administration_route", "is", null);
  if (error || !data) return [];
  return Array.from(new Set(data.map((r) => r.administration_route as string).filter(Boolean))).sort();
}

// ── Database statistics ───────────────────────────────────────────────────────

/** Get database statistics */
export async function getDatabaseStatistics(): Promise<{
  total_papers: number;
  total_formulations: number;
  total_materials: number;
  total_experiments: number;
  total_biological_outcomes: number;
}> {
  const [papers, formulations, materials, experiments, outcomes] =
    await Promise.all([
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
