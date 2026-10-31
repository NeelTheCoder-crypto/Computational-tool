# NANP Carrier Selection Platform

A research tool for exploring nucleic acid delivery carriers. It reads a public
Google Sheet and lets you filter the records by disease, route of administration
and cargo type.

The sheet is the only data source, and the app only reads from it:
https://docs.google.com/spreadsheets/d/1Z1Ua5BqBYKhvfDn1hxSMK1NjrZq2bjkhcEQTbEih9YQ/edit

No API keys or secrets are needed. The sheet is fetched as CSV and cached on the server for 5 minutes.

## How it's put together

- `artifacts/nanp-app`: the website (React + Vite + Tailwind)
- `artifacts/api-server`: a small Express server. `GET /api/sheet` returns the
  parsed sheet; `GET /api/healthz` is a health check. In production it also
  serves the built website, so the whole app is one service.
- `lib/api-spec/openapi.yaml`: the API contract. `lib/api-client-react` and
  `lib/api-zod` are generated from it with
  `pnpm --filter @workspace/api-spec run codegen`.

Sheet parsing and tagging live in `artifacts/api-server/src/lib/carrierSheet.ts`.

## Run locally

```sh
pnpm install
pnpm --filter @workspace/api-server run dev   # API on http://localhost:8080
pnpm --filter @workspace/nanp-app run dev     # website on http://localhost:5173
```

The website's dev server forwards `/api` requests to the API server.

Tests: `pnpm --filter @workspace/api-server run test`

## Deploy to Google Cloud Run

The `Dockerfile` builds everything into one container that listens on `$PORT`.

**From the Google Cloud console (deploys automatically on every push):**

1. Go to Cloud Run → **Deploy container** → **Service**.
2. Choose **Continuously deploy from a repository (source or function)** →
   **Set up with Cloud Build**.
3. Connect GitHub and pick `NeelTheCoder-crypto/computational-tool`, branch `main`.
4. Build type: **Dockerfile**, path `/Dockerfile`.
5. Under Authentication, choose **Allow unauthenticated invocations** (public website).
6. Click **Create**.

**From a terminal with `gcloud`:**

```sh
gcloud run deploy computational-tool --source . --region us-central1 --allow-unauthenticated
```
