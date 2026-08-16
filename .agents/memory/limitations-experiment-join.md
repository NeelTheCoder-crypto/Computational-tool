---
name: Limitations/mechanisms join via experiment_id
description: The DB stores limitations and mechanisms at the experiment level, not per-formulation — must join via experiment_id to reach them from a formulation.
---

# Limitations and mechanisms join via experiment_id

The `limitations` and `mechanisms` tables are linked to experiments (via `experiment_id`), **not** directly to formulations. To retrieve them for a formulation:

1. Join `formulations → experimental_arms → experiment_id → experiments`
2. Then join to `limitations` / `mechanisms` on `experiment_id`.

**Why:** The schema reflects that limitations are reported in the context of a specific experimental study, not inherent to the carrier formulation itself.

**How to apply:** Any query that tries to join `limitations` or `mechanisms` directly to `formulations` will return no rows. Always bridge through `experimental_arms → experiments`.
