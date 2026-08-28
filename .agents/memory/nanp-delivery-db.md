---
name: NANP delivery database (Supabase)
description: Schema and matching rules for the pulmonary/mucosal nucleic-acid delivery DB behind the NANP Carrier Selection Platform.
---

# NANP delivery database (Supabase)

The `api-server` reads a normalized Supabase DB of pulmonary/mucosal nucleic-acid delivery literature.

## All primary keys are UUID strings
Every `*_id` column is a **UUID string**, not an integer. Type IDs as `string` in TS and the OpenAPI spec; never `Number()`-validate an ID path param.

## Experimental arm is the join nexus for multi-filter queries
A carrier (formulation) matches a cargo/disease/route combination through experimental arms:
- cargo type → `formulation_cargos` → `cargos.cargo_type`
- route → `experimental_arms.administration_route` (arm's `formulation_cargo_id` belongs to the formulation)
- disease → `experimental_arms.experiment_id` → `experiments.model_id` → `models.disease_model`

**Multi-filter conjunction rule (critical):** when 2+ filters are active, at least one arm must satisfy ALL active dimensions simultaneously. Cross-arm bridging ("split-arm") is a false positive — a formulation that has one arm with the route and a different arm with the disease must NOT match.

**Single-filter exceptions:**
- cargo only → `formulation_cargos` join is sufficient (no arm required)
- route only → arm route OR `formulations.intended_route` fallback
- disease only → arm only (no fallback)

The `intended_route` fallback is only valid for single-dimension route queries.

## Route umbrella: "inhalation" includes "nebulized_inhalation"
Stored routes: `intravenous, inhalation, nebulized_inhalation, intratracheal, intranasal`. CF and airway records are curated under `nebulized_inhalation`, so querying `inhalation` must also match `nebulized_inhalation`. This is one-directional — the specific value never widens to the umbrella.
**Why:** `mRNA + cystic fibrosis + inhalation` returns 0 with strict equality because those arms are stored as `nebulized_inhalation`.

## Evidence scoring
Favorable outcome = `result_polarity === 'beneficial'` OR `direction_vs_comparator === 'improved'`. Adverse = `'adverse'`/`'reduced'`. Score = `matchingArms×10 + favorable×3 + supporting×1 − adverse×2`. For filtered queries, count outcomes on matching arms only — never fall back to unrelated arms (that would count evidence for wrong cargo/route/disease combinations).

## Discovery must preserve the catalog
Strict same-arm conjunction remains the definition of a direct multi-input match, but carrier inputs organize rather than eliminate the formulation catalog. Rank direct matches first, independently related records second, and unmatched catalog records last.

**Why:** Sparse literature relationships make strict filtering return empty results for many scientifically useful input combinations. Hiding everything else prevents researchers from seeing what evidence exists and where the gaps are.

**How to apply:** Label evidence tiers explicitly and report how many selected dimensions each formulation supports. Never call a partial or unfiltered result optimal, and never imply split-arm evidence is direct combined evidence.

## Pure matching logic lives in `carrierMatchingPure.ts`
The matching functions (`matchFormulationIds`, `expandRoute`) and types (`Graph`, `GraphArm`, `CarrierFilters`) are in a Supabase-free module so unit tests can import them directly via `--experimental-strip-types`. Test file excluded from `tsconfig.json` `include` (uses `.ts` extension imports for direct node execution).
