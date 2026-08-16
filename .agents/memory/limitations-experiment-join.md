---
name: Limitations and mechanisms join via experiment_id
description: The limitations and mechanisms tables store records at the experiment level, not per-formulation. Querying by formulation_id returns data only for the "lead" formulation the extractor happened to use. All formulations in the same experiment must be queried via experiment_id.
---

# Limitations and mechanisms join via experiment_id

The `limitations` and `mechanisms` tables each have both `formulation_id` and `experiment_id` columns. Data extraction stores rows under whichever formulation the curator treated as the lead for the study — not once per formulation. As a result, `.eq("formulation_id", uuid)` returns empty for all "secondary" formulations even when they genuinely belong to the same experiment and share the same study-level insights.

**Why:** DB schema reflects study-level extraction, not per-formulation extraction. One lead formulation per experiment gets the FK stored under its UUID; siblings share the same `experiment_id`.

**How to apply:** In `getFormulationById`, derive `experimentIds` from the arm chain (`formulation_cargos → experimental_arms.experiment_id`) and query both tables with `.in("experiment_id", experimentIds)`. This is already implemented in `artifacts/api-server/src/lib/supabaseQueries.ts`.

**Corollary:** `biological_outcomes` may have a similar issue — outcomes for secondary arms might be zero because they are also stored under the lead arm. See task #14 for investigation.
