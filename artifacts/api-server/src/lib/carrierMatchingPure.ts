/**
 * Pure, Supabase-free carrier-matching logic.
 *
 * Extracted so unit tests can import this file directly via
 * `--experimental-strip-types` without needing any runtime dependencies.
 * supabaseQueries.ts re-exports what the rest of the server needs.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface CarrierFilters {
  cargoType?: string | undefined;
  disease?: string | undefined;
  route?: string | undefined;
}

export interface GraphArm {
  arm_id: string;
  formulation_id: string | null;
  cargo_type: string | null;
  route: string | null;
  disease_model: string | null;
}

export interface Graph {
  /** formulation_id -> set of cargo types linked via formulation_cargos */
  cargoTypesByFormulation: Map<string, Set<string>>;
  /** formulation_id -> arms that belong to it */
  armsByFormulation: Map<string, GraphArm[]>;
  /** formulation_id -> intended_route (single-filter fallback signal) */
  intendedRouteByFormulation: Map<string, string | null>;
  /** arm_id -> outcome counts */
  outcomeCountsByArm: Map<string, { total: number; favorable: number; adverse: number }>;
}

export interface FormulationMatchInfo {
  matchingArms: GraphArm[];
  matchedCargoTypes: Set<string>;
  matchedRoutes: Set<string>;
  matchedDiseaseModels: Set<string>;
}

// ---------------------------------------------------------------------------
// Route expansion
// ---------------------------------------------------------------------------

/**
 * Route hierarchy: "inhalation" is an umbrella that includes
 * "nebulized_inhalation" (a stored subtype). All other routes match exactly.
 * Selecting a specific route never widens to the broad umbrella — this is
 * one-directional to prevent spurious matches.
 */
export function expandRoute(route: string): Set<string> {
  if (route === "inhalation") return new Set(["inhalation", "nebulized_inhalation"]);
  return new Set([route]);
}

// ---------------------------------------------------------------------------
// Carrier matching
// ---------------------------------------------------------------------------

/**
 * Resolve the set of formulation IDs the database links to the given filters.
 *
 * Conjunction rule:
 *   - 0 filters   → every formulation in the graph.
 *   - 1 filter    → cargo: satisfied by formulation_cargos join (no arm required);
 *                    route: any arm's route OR intended_route fallback;
 *                    disease: at least one arm whose disease model matches.
 *   - 2–3 filters → requires AT LEAST ONE arm that satisfies ALL active filters
 *                    simultaneously. Cross-arm bridging ("split-arm") is NOT
 *                    accepted. The intended_route fallback is only valid for
 *                    single-dimension route queries.
 *
 * Returns matched IDs with, per formulation, the matching arms and the
 * dimension values covered — ready for ranking/hydration.
 */
export function matchFormulationIds(
  graph: Graph,
  filters: CarrierFilters
): Map<string, FormulationMatchInfo> {
  const { cargoType, disease, route } = filters;
  const hasCargo = !!cargoType;
  const hasDisease = !!disease;
  const hasRoute = !!route;
  const acceptedRoutes = hasRoute ? expandRoute(route!) : null;
  const activeCount = [hasCargo, hasRoute, hasDisease].filter(Boolean).length;

  // Every formulation known to the graph is a candidate.
  const candidateIds = new Set<string>([
    ...graph.cargoTypesByFormulation.keys(),
    ...graph.armsByFormulation.keys(),
    ...graph.intendedRouteByFormulation.keys(),
  ]);

  const result = new Map<string, FormulationMatchInfo>();

  for (const fid of candidateIds) {
    const arms = graph.armsByFormulation.get(fid) ?? [];
    const cargoTypes = graph.cargoTypesByFormulation.get(fid) ?? new Set<string>();
    const intendedRoute = graph.intendedRouteByFormulation.get(fid) ?? null;

    // Arms that satisfy ALL active filters simultaneously.
    const matchingArms = arms.filter(
      (a) =>
        (!hasCargo || a.cargo_type === cargoType) &&
        (!hasRoute || (a.route != null && acceptedRoutes!.has(a.route))) &&
        (!hasDisease || a.disease_model === disease)
    );

    // Admission decision.
    let admitted = false;
    if (activeCount === 0) {
      admitted = true;
    } else if (activeCount >= 2) {
      // Multi-filter: one arm must co-satisfy every active dimension.
      admitted = matchingArms.length > 0;
    } else {
      if (hasCargo) {
        // Cargo: formulation_cargos join is sufficient (arm not required).
        admitted = cargoTypes.has(cargoType!);
      } else if (hasRoute) {
        // Route: arm evidence first; intended_route as single-filter fallback.
        admitted =
          matchingArms.length > 0 ||
          (intendedRoute != null && acceptedRoutes!.has(intendedRoute));
      } else {
        // Disease: only reachable via experimental arms.
        admitted = matchingArms.length > 0;
      }
    }
    if (!admitted) continue;

    // Dimension values to report.
    // Filtered queries: report from matchingArms only.
    // Browse mode (no filters): report from all arms.
    const armsForReporting = activeCount === 0 ? arms : matchingArms;

    const matchedCargoTypes = new Set<string>();
    if (hasCargo) {
      matchedCargoTypes.add(cargoType!);
    } else {
      cargoTypes.forEach((c) => matchedCargoTypes.add(c));
    }

    const matchedRoutes = new Set<string>();
    const matchedDiseaseModels = new Set<string>();
    for (const a of armsForReporting) {
      if (a.route) matchedRoutes.add(a.route);
      if (a.disease_model) matchedDiseaseModels.add(a.disease_model);
    }

    if (hasRoute) {
      // Report concrete route values (e.g. "nebulized_inhalation" under "inhalation" umbrella).
      matchedRoutes.clear();
      for (const a of matchingArms) {
        if (a.route && acceptedRoutes!.has(a.route)) matchedRoutes.add(a.route);
      }
      // Single-route query: capture intended_route fallback if no arm matched.
      if (matchedRoutes.size === 0 && intendedRoute && acceptedRoutes!.has(intendedRoute)) {
        matchedRoutes.add(intendedRoute);
      }
    }
    if (hasDisease) {
      matchedDiseaseModels.clear();
      matchedDiseaseModels.add(disease!);
    }

    result.set(fid, { matchingArms, matchedCargoTypes, matchedRoutes, matchedDiseaseModels });
  }

  return result;
}
