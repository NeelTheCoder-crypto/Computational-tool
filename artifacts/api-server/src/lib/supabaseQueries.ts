/**
 * Supabase retrieval functions for the NANP Carrier Selection Platform.
 * These functions query the normalized database and return evidence records
 * that are passed to the LLM for reasoning. The LLM never touches the DB directly.
 */

import { supabase } from "./supabase.js";

export interface FormulationRecord {
  id: number;
  name: string | null;
  description: string | null;
  formulation_type: string | null;
  cargo_types: string[];
  material_names: string[];
  targeting_strategies: string[];
  processes: string[];
}

export interface MaterialRecord {
  id: number;
  name: string | null;
  material_type: string | null;
  description: string | null;
}

export interface OutcomeRecord {
  id: number;
  outcome_type: string | null;
  cell_line: string | null;
  tissue_type: string | null;
  in_vivo_model: string | null;
  outcome_value: number | null;
  outcome_unit: string | null;
  metric_name: string | null;
  notes: string | null;
  formulation_name: string | null;
}

export interface MechanismRecord {
  id: number;
  mechanism_type: string | null;
  description: string | null;
  formulation_name: string | null;
}

export interface LimitationRecord {
  id: number;
  limitation_type: string | null;
  description: string | null;
  formulation_name: string | null;
}

export interface PaperRecord {
  id: number;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  abstract: string | null;
}

export interface PhysicochemicalRecord {
  id: number;
  measurement_type: string | null;
  value: number | null;
  unit: string | null;
  formulation_name: string | null;
}

/** Retrieve formulations with their materials, cargos, targeting strategies */
export async function getFormulations(filters?: {
  cargoType?: string;
  disease?: string;
}): Promise<FormulationRecord[]> {
  // Start with base formulations
  const { data: formulations, error: formError } = await supabase
    .from("formulations")
    .select("id, name, description, formulation_type")
    .limit(100);

  if (formError || !formulations) {
    return [];
  }

  const formIds = formulations.map((f) => f.id);

  // Get materials for these formulations
  const { data: fmData } = await supabase
    .from("formulation_materials")
    .select("formulation_id, materials(name)")
    .in("formulation_id", formIds);

  // Get cargos
  const { data: fcData } = await supabase
    .from("formulation_cargos")
    .select("formulation_id, cargos(cargo_type)")
    .in("formulation_id", formIds);

  // Get targeting strategies
  const { data: ftData } = await supabase
    .from("formulation_targeting")
    .select("formulation_id, targeting_strategy")
    .in("formulation_id", formIds);

  // Get processes
  const { data: fpData } = await supabase
    .from("formulation_processes")
    .select("formulation_id, process_name")
    .in("formulation_id", formIds);

  // Assemble
  return formulations.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    formulation_type: f.formulation_type,
    cargo_types: (fcData || [])
      .filter((fc) => fc.formulation_id === f.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((fc) => (fc.cargos as any)?.cargo_type)
      .filter(Boolean),
    material_names: (fmData || [])
      .filter((fm) => fm.formulation_id === f.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((fm) => (fm.materials as any)?.name)
      .filter(Boolean),
    targeting_strategies: (ftData || [])
      .filter((ft) => ft.formulation_id === f.id)
      .map((ft) => ft.targeting_strategy)
      .filter(Boolean) as string[],
    processes: (fpData || [])
      .filter((fp) => fp.formulation_id === f.id)
      .map((fp) => fp.process_name)
      .filter(Boolean) as string[],
  }));
}

/** Retrieve materials from the database */
export async function getMaterials(): Promise<MaterialRecord[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("id, name, material_type, description")
    .limit(200);

  if (error || !data) return [];
  return data;
}

/** Retrieve biological outcomes linked to formulations */
export async function getOutcomes(): Promise<OutcomeRecord[]> {
  const { data, error } = await supabase
    .from("biological_outcomes")
    .select(
      `id, outcome_type, cell_line, tissue_type, in_vivo_model, outcome_value, outcome_unit, metric_name, notes,
       experimental_arms(experiments(formulations(name)))`
    )
    .limit(300);

  if (error || !data) return [];

  return data.map((o) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arm = (o as any).experimental_arms;
    const exp = arm?.experiments;
    const form = exp?.formulations;
    return {
      id: o.id,
      outcome_type: o.outcome_type,
      cell_line: o.cell_line,
      tissue_type: o.tissue_type,
      in_vivo_model: o.in_vivo_model,
      outcome_value: o.outcome_value,
      outcome_unit: o.outcome_unit,
      metric_name: o.metric_name,
      notes: o.notes,
      formulation_name: form?.name ?? null,
    };
  });
}

/** Retrieve delivery mechanisms */
export async function getMechanisms(): Promise<MechanismRecord[]> {
  const { data, error } = await supabase
    .from("mechanisms")
    .select("id, mechanism_type, description, formulations(name)")
    .limit(200);

  if (error || !data) return [];

  return data.map((m) => ({
    id: m.id,
    mechanism_type: m.mechanism_type,
    description: m.description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formulation_name: (m.formulations as any)?.name ?? null,
  }));
}

/** Retrieve known limitations of formulations */
export async function getLimitations(): Promise<LimitationRecord[]> {
  const { data, error } = await supabase
    .from("limitations")
    .select("id, limitation_type, description, formulations(name)")
    .limit(200);

  if (error || !data) return [];

  return data.map((l) => ({
    id: l.id,
    limitation_type: l.limitation_type,
    description: l.description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formulation_name: (l.formulations as any)?.name ?? null,
  }));
}

/** Retrieve supporting papers */
export async function getSupportingPapers(): Promise<PaperRecord[]> {
  const { data, error } = await supabase
    .from("papers")
    .select("id, title, authors, journal, year, doi, abstract")
    .limit(100);

  if (error || !data) return [];
  return data;
}

/** Retrieve physicochemical measurements */
export async function getPhysicochemicalMeasurements(): Promise<
  PhysicochemicalRecord[]
> {
  const { data, error } = await supabase
    .from("physicochemical_measurements")
    .select("id, measurement_type, value, unit, experiments(formulations(name))")
    .limit(300);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    measurement_type: p.measurement_type,
    value: p.value,
    unit: p.unit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formulation_name: (p.experiments as any)?.formulations?.name ?? null,
  }));
}

/** Get distinct dropdown options by querying the actual data */
export async function getDropdownOptions(): Promise<{
  nucleic_acids: string[];
  diseases: string[];
  routes_of_administration: string[];
}> {
  // Nucleic acid types from cargos table
  const { data: cargoData } = await supabase
    .from("cargos")
    .select("cargo_type")
    .not("cargo_type", "is", null);

  // Disease/condition from experimental_conditions
  const { data: conditionData } = await supabase
    .from("experimental_conditions")
    .select("disease_model")
    .not("disease_model", "is", null);

  // Route of administration from experimental_conditions
  const { data: routeData } = await supabase
    .from("experimental_conditions")
    .select("route_of_administration")
    .not("route_of_administration", "is", null);

  const nucleic_acids = Array.from(
    new Set(
      (cargoData || [])
        .map((c) => c.cargo_type as string)
        .filter(Boolean)
    )
  ).sort();

  const diseases = Array.from(
    new Set(
      (conditionData || [])
        .map((c) => c.disease_model as string)
        .filter(Boolean)
    )
  ).sort();

  const routes_of_administration = Array.from(
    new Set(
      (routeData || [])
        .map((r) => r.route_of_administration as string)
        .filter(Boolean)
    )
  ).sort();

  // If DB doesn't have data yet, return common defaults
  return {
    nucleic_acids:
      nucleic_acids.length > 0
        ? nucleic_acids
        : [
            "mRNA",
            "siRNA",
            "pDNA",
            "miRNA",
            "antisense oligonucleotide (ASO)",
            "saRNA",
            "sgRNA",
            "shRNA",
          ],
    diseases:
      diseases.length > 0
        ? diseases
        : [
            "cancer",
            "inflammatory disease",
            "genetic disorder",
            "infectious disease",
            "cardiovascular disease",
            "neurological disorder",
            "metabolic disease",
          ],
    routes_of_administration:
      routes_of_administration.length > 0
        ? routes_of_administration
        : [
            "intravenous",
            "intramuscular",
            "subcutaneous",
            "intranasal",
            "intratumoral",
            "oral",
            "intraperitoneal",
            "intraocular",
          ],
  };
}

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
      supabase.from("papers").select("id", { count: "exact", head: true }),
      supabase
        .from("formulations")
        .select("id", { count: "exact", head: true }),
      supabase.from("materials").select("id", { count: "exact", head: true }),
      supabase
        .from("experiments")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("biological_outcomes")
        .select("id", { count: "exact", head: true }),
    ]);

  return {
    total_papers: papers.count ?? 0,
    total_formulations: formulations.count ?? 0,
    total_materials: materials.count ?? 0,
    total_experiments: experiments.count ?? 0,
    total_biological_outcomes: outcomes.count ?? 0,
  };
}
