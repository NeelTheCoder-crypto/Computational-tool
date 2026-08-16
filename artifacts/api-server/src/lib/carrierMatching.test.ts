/**
 * Unit tests for matchFormulationIds and expandRoute.
 *
 * These tests run directly with Node's built-in test runner (no framework deps):
 *   node --experimental-strip-types --test src/lib/carrierMatching.test.ts
 *
 * We construct minimal in-memory Graph fixtures so the tests are fully
 * deterministic and don't touch Supabase.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchFormulationIds, expandRoute, type Graph } from "./carrierMatchingPure.ts";

// ---------------------------------------------------------------------------
// Graph fixture factory
// ---------------------------------------------------------------------------

function makeGraph(opts: {
  formulations: Array<{
    id: string;
    cargoTypes?: string[];
    intendedRoute?: string;
    arms?: Array<{
      arm_id: string;
      cargo_type?: string;
      route?: string;
      disease_model?: string;
    }>;
  }>;
}): Graph {
  const cargoTypesByFormulation = new Map<string, Set<string>>();
  const armsByFormulation = new Map<string, import("./supabaseQueries.js").GraphArm[]>();
  const intendedRouteByFormulation = new Map<string, string | null>();
  const outcomeCountsByArm = new Map<
    string,
    { total: number; favorable: number; adverse: number }
  >();

  for (const f of opts.formulations) {
    // Cargo types via formulation_cargos
    if (f.cargoTypes && f.cargoTypes.length > 0) {
      cargoTypesByFormulation.set(f.id, new Set(f.cargoTypes));
    }
    // intended_route fallback
    intendedRouteByFormulation.set(f.id, f.intendedRoute ?? null);
    // Arms
    const arms = (f.arms ?? []).map((a) => ({
      arm_id: a.arm_id,
      formulation_id: f.id,
      cargo_type: a.cargo_type ?? null,
      route: a.route ?? null,
      disease_model: a.disease_model ?? null,
    }));
    if (arms.length > 0) armsByFormulation.set(f.id, arms);
  }

  return {
    cargoTypesByFormulation,
    armsByFormulation,
    intendedRouteByFormulation,
    outcomeCountsByArm,
  };
}

// ---------------------------------------------------------------------------
// expandRoute tests
// ---------------------------------------------------------------------------

describe("expandRoute", () => {
  it("returns the route itself for non-umbrella values", () => {
    const r = expandRoute("intravenous");
    assert.ok(r.has("intravenous"));
    assert.equal(r.size, 1);
  });

  it("inhalation umbrella includes nebulized_inhalation", () => {
    const r = expandRoute("inhalation");
    assert.ok(r.has("inhalation"), "should include the literal value");
    assert.ok(r.has("nebulized_inhalation"), "should include the sub-route");
  });

  it("nebulized_inhalation does NOT expand to the broad umbrella", () => {
    const r = expandRoute("nebulized_inhalation");
    assert.ok(r.has("nebulized_inhalation"));
    assert.ok(!r.has("inhalation"), "sub-route must not widen to umbrella");
  });
});

// ---------------------------------------------------------------------------
// matchFormulationIds tests
// ---------------------------------------------------------------------------

describe("matchFormulationIds — empty filter", () => {
  it("returns every formulation in the graph when no filters are set", () => {
    const graph = makeGraph({
      formulations: [
        { id: "F1", cargoTypes: ["mRNA"] },
        { id: "F2", cargoTypes: ["siRNA"] },
        { id: "F3", intendedRoute: "intravenous" },
      ],
    });
    const result = matchFormulationIds(graph, {});
    assert.equal(result.size, 3);
  });
});

describe("matchFormulationIds — single cargo filter", () => {
  it("matches via formulation_cargos even when the formulation has no arms", () => {
    const graph = makeGraph({
      formulations: [
        { id: "F_mRNA_no_arm", cargoTypes: ["mRNA"] }, // cargo via fc, no arms
        { id: "F_siRNA", cargoTypes: ["siRNA"] },
      ],
    });
    const result = matchFormulationIds(graph, { cargoType: "mRNA" });
    assert.ok(result.has("F_mRNA_no_arm"), "should match via formulation_cargos");
    assert.ok(!result.has("F_siRNA"), "different cargo type must not match");
  });

  it("includes formulations with arms for that cargo type", () => {
    const graph = makeGraph({
      formulations: [
        {
          id: "F_with_arm",
          cargoTypes: ["mRNA"],
          arms: [{ arm_id: "A1", cargo_type: "mRNA", route: "intravenous", disease_model: "lung cancer" }],
        },
      ],
    });
    const result = matchFormulationIds(graph, { cargoType: "mRNA" });
    assert.ok(result.has("F_with_arm"));
    assert.equal(result.get("F_with_arm")!.matchingArms.length, 1);
  });
});

describe("matchFormulationIds — single route filter (intended_route fallback)", () => {
  it("matches via intended_route when no arm carries the route", () => {
    const graph = makeGraph({
      formulations: [
        { id: "F_intended", intendedRoute: "inhalation" }, // no arms
      ],
    });
    const result = matchFormulationIds(graph, { route: "inhalation" });
    assert.ok(result.has("F_intended"), "should match via intended_route fallback");
  });

  it("route umbrella matches nebulized_inhalation via arm", () => {
    const graph = makeGraph({
      formulations: [
        {
          id: "F_nebulized",
          arms: [{ arm_id: "A1", route: "nebulized_inhalation" }],
        },
      ],
    });
    const result = matchFormulationIds(graph, { route: "inhalation" });
    assert.ok(result.has("F_nebulized"), "nebulized_inhalation should fall under inhalation umbrella");
    const info = result.get("F_nebulized")!;
    assert.ok(info.matchedRoutes.has("nebulized_inhalation"), "should report the concrete sub-route");
  });
});

describe("matchFormulationIds — multi-filter conjunction", () => {
  it("requires ALL active filters to be satisfied by one arm (no split-arm bridging)", () => {
    // F_split has:
    //   arm_a: mRNA + nebulized_inhalation + lung_cancer (route✓ but wrong disease)
    //   arm_b: mRNA + intravenous + cystic_fibrosis    (disease✓ but wrong route)
    // No single arm satisfies (mRNA AND inhalation AND cystic_fibrosis) → must NOT match
    const graph = makeGraph({
      formulations: [
        {
          id: "F_split",
          cargoTypes: ["mRNA"],
          arms: [
            { arm_id: "A_split_a", cargo_type: "mRNA", route: "nebulized_inhalation", disease_model: "lung cancer" },
            { arm_id: "A_split_b", cargo_type: "mRNA", route: "intravenous",          disease_model: "cystic fibrosis" },
          ],
        },
        {
          id: "F_good",
          cargoTypes: ["mRNA"],
          arms: [
            { arm_id: "A_good", cargo_type: "mRNA", route: "nebulized_inhalation", disease_model: "cystic fibrosis" },
          ],
        },
      ],
    });
    const result = matchFormulationIds(graph, {
      cargoType: "mRNA",
      route: "inhalation",     // umbrella: covers nebulized_inhalation
      disease: "cystic fibrosis",
    });
    assert.ok(!result.has("F_split"), "split-arm formulation must NOT be a false positive");
    assert.ok(result.has("F_good"),   "formulation with a co-satisfying arm must match");
  });

  it("intended_route fallback is NOT used for multi-filter queries", () => {
    const graph = makeGraph({
      formulations: [
        // Cargo OK (via fc) and intended_route matches, but no arm and disease active → no match
        { id: "F_fallback_only", cargoTypes: ["mRNA"], intendedRoute: "inhalation" },
      ],
    });
    const result = matchFormulationIds(graph, {
      cargoType: "mRNA",
      disease: "cystic fibrosis",
    });
    assert.ok(!result.has("F_fallback_only"), "intended_route must not bridge a multi-filter query");
  });

  it("cargo + disease match with co-satisfying arm", () => {
    const graph = makeGraph({
      formulations: [
        {
          id: "F_ok",
          cargoTypes: ["siRNA"],
          arms: [
            { arm_id: "A1", cargo_type: "siRNA", route: "intranasal", disease_model: "cystic fibrosis" },
          ],
        },
        {
          id: "F_wrong_disease",
          cargoTypes: ["siRNA"],
          arms: [
            { arm_id: "A2", cargo_type: "siRNA", route: "intranasal", disease_model: "lung cancer" },
          ],
        },
      ],
    });
    const result = matchFormulationIds(graph, {
      cargoType: "siRNA",
      disease: "cystic fibrosis",
    });
    assert.ok(result.has("F_ok"),            "should match when arm satisfies both cargo and disease");
    assert.ok(!result.has("F_wrong_disease"), "must not match when disease is wrong");
  });

  it("route umbrella works correctly inside a multi-filter query", () => {
    // inhalation umbrella should include nebulized_inhalation even in multi-filter mode
    const graph = makeGraph({
      formulations: [
        {
          id: "F_nebulized_cf",
          cargoTypes: ["mRNA"],
          arms: [
            { arm_id: "A1", cargo_type: "mRNA", route: "nebulized_inhalation", disease_model: "cystic fibrosis" },
          ],
        },
      ],
    });
    const result = matchFormulationIds(graph, {
      cargoType: "mRNA",
      route: "inhalation",
      disease: "cystic fibrosis",
    });
    assert.ok(result.has("F_nebulized_cf"), "nebulized_inhalation must satisfy inhalation in multi-filter");
    const routes = result.get("F_nebulized_cf")!.matchedRoutes;
    assert.ok(routes.has("nebulized_inhalation"), "should report the concrete sub-route");
  });
});
