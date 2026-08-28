---
name: api-client-react stale dist declarations
description: Why nanp-app typecheck can fail with wrong schema names after the API client is regenerated
---

The `@workspace/api-client-react` package's `exports["."]` points at `src/index.ts`, but consuming artifacts (e.g. `artifacts/nanp-app`) reference it as a **composite TS project** (`references` + `composite: true`), so their `tsc` resolves types from the package's emitted `dist/*.d.ts`, not the source.

**Symptom:** typecheck errors naming schema members that don't exist in the current `src/generated/*` (e.g. old `papers`/`FormulationPaper` instead of current `paper`/`PaperSummary`, or "has no exported member 'matchCarriers'") even though the source clearly exports them.

**Why:** the API-layer task regenerates `src/generated/*` but leaves `dist/` stale. Consumers see the old declarations.

**How to apply:** after the API client is regenerated, rebuild declarations before typechecking consumers:
`pnpm run typecheck:libs` (root, runs `tsc --build`) regenerates `lib/api-client-react/dist`. Then the artifact typecheck passes.
