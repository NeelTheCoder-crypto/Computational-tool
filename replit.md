# NANP Carrier Selection Platform

A scientific research application for identifying optimal nucleic acid delivery carriers. Researchers enter a therapeutic nucleic acid type, disease, and route of administration; the platform queries a Supabase literature database and uses OpenAI to synthesize a grounded carrier recommendation traceable to retrieved records.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/nanp-app run dev` — run the frontend (Vite, port from env)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (artifacts/nanp-app)
- API: Express 5 (artifacts/api-server)
- Database: Supabase (external PostgreSQL — existing schema, read-only via anon key)
- AI: OpenAI via Replit AI Integrations proxy (gpt-5.6-terra)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)

## Environment Variables

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key (public, safe for server-side use)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set by Replit AI Integrations
- `SESSION_SECRET` — session secret (pre-configured)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not hand-edit)
- `lib/api-zod/src/generated/` — generated Zod validation schemas (do not hand-edit)
- `lib/integrations-openai-ai-server/` — pre-configured OpenAI SDK client
- `artifacts/api-server/src/lib/supabaseQueries.ts` — all Supabase retrieval functions
- `artifacts/api-server/src/routes/recommend.ts` — main recommendation route (POST /api/recommend)
- `artifacts/api-server/src/routes/options.ts` — dropdown options (GET /api/options)
- `artifacts/api-server/src/routes/stats.ts` — database stats (GET /api/stats)
- `artifacts/nanp-app/src/pages/home.tsx` — query input page
- `artifacts/nanp-app/src/pages/results.tsx` — recommendation results page

## Architecture decisions

- **Backend owns all database access.** OpenAI never touches Supabase directly — the Express server retrieves all evidence first, then passes it to the LLM as context. This ensures security, reliability, and full retrieval control.
- **Supabase anon key only.** The app uses read-only Supabase queries via the anon key. No service role key is needed or used.
- **OpenAI via Replit AI Integrations.** No user-supplied API key required. Uses `gpt-5.6-terra` for the recommendation synthesis step.
- **Codegen-first contract.** All API types flow from `lib/api-spec/openapi.yaml` → Orval → typed hooks + Zod schemas. Do not hand-write types duplicating the spec.
- **Modular retrieval layer.** `supabaseQueries.ts` exports standalone functions (`getFormulations`, `getMaterials`, etc.) so the retrieval logic can be improved or replaced (e.g. with embeddings/vector search) without touching the route or frontend.

## Product

1. User selects therapeutic nucleic acid, disease, and route of administration from dropdowns
2. Frontend POSTs to `/api/recommend`
3. Backend retrieves formulations, materials, outcomes, mechanisms, limitations, and papers from Supabase in parallel
4. Retrieved evidence is sent to OpenAI which synthesizes a structured recommendation
5. Results page displays: recommended carrier, confidence, scientific rationale, key components, advantages, limitations, supporting mechanisms, supporting publications, and alternative formulations

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any change to `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before modifying frontend or backend code.
- The `/api/recommend` endpoint takes 5–30 seconds depending on database size and LLM latency. The frontend shows a cycling progress indicator.
- Supabase table names are snake_case and match the schema in the brief exactly.
