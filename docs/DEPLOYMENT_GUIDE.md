# FairScan Deployment Guide (Vercel + Cloud Run, No Dockerfile)

This guide is written for beginners and matches this repository's current setup:

- Frontend (`client`) -> **Vercel**
- Backend API (`server`) -> **Google Cloud Run** (from GitHub source)
- ML service (`services/ml-audit-service`) -> **Google Cloud Run** (from GitHub source)

No Dockerfile is required. Cloud Buildpacks will build from source.

---

## 1) Before You Start

You need:

- A GitHub account and this repo pushed to GitHub
- A Vercel account
- A Google Cloud project with billing enabled
- MongoDB Atlas connection string
- A Google OAuth Web Client ID
- A GCS bucket for dataset files

Official docs (latest references):

- [Vercel Git deployments](https://vercel.com/docs/deployments/git)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Cloud Run deploy from source](https://cloud.google.com/run/docs/deploying-source-code)
- [Cloud Run env vars](https://cloud.google.com/run/docs/configuring/services/environment-variables)
- [Cloud Run with GitHub](https://cloud.google.com/run/docs/continuous-deployment-with-cloud-build)
- [Google OAuth web app setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)

---

## 2) Security First (Important)

Before production:

1. Rotate any previously exposed secrets (API keys, DB URI passwords, private keys).
2. Do not commit `.env` files.
3. Keep `scripts/check-tracked-secrets.js` passing:

```bash
npm run security:check-secrets
```

---

## 3) Pre-Deploy Checks (Local)

From repo root:

```bash
npm run security:check-secrets
npm run test -w server
npm run build -w client
```

All should pass before deploying.

---

## 4) Environment Variables - What to Change vs Keep

## A) Frontend (`client`) - Vercel env vars

Set these in Vercel Project -> Settings -> Environment Variables:

- `VITE_API_BASE_URL` -> **CHANGE** to your backend URL:
  - Example: `https://fairscan-api-xxxx-uc.a.run.app/api/v1`
- `VITE_GOOGLE_CLIENT_ID` -> **KEEP/SET** your Google OAuth Web Client ID

Do not set secrets in frontend env vars.

## B) Backend (`server`) - Cloud Run env vars

Use `server/.env.example` as reference. Production values:

- `NODE_ENV` -> **CHANGE** to `production`
- `PORT` -> **DO NOT set manually** (Cloud Run injects this)
- `MONGO_URI` -> **CHANGE** to MongoDB Atlas URI
- `MONGO_TIMEOUT_MS` -> usually keep `3000`
- `DB_REQUIRED` -> **SET** `true`
- `JWT_SECRET` -> **CHANGE** to strong random secret
- `JWT_EXPIRES_IN` -> keep `7d` (or your policy)
- `CORS_ORIGIN` -> **CHANGE** to exact Vercel domain(s), comma-separated
  - Example: `https://fairscan.vercel.app,https://www.fairscan.ai`
- `GEMINI_API_KEY` -> **SET** real key
- `GEMINI_MODEL` -> keep `gemini-2.5-pro` unless you intentionally change
- `GEMINI_TIMEOUT_MS` -> keep `12000` unless needed
- `GEMINI_ALERT_WEBHOOK_URL` -> optional
- `GOOGLE_OAUTH_CLIENT_ID` -> **SET** same Client ID used in frontend
- `ML_SERVICE_URL` -> **CHANGE** to deployed ML Cloud Run URL
  - Example: `https://fairscan-ml-xxxx-uc.a.run.app`
- `ML_SERVICE_TIMEOUT_MS` -> keep `4000` or increase if needed
- `ML_ALLOW_MOCK_FALLBACK` -> **SET `false` in production**
- `AUTH_RATE_LIMIT_WINDOW_MS` -> keep `60000`
- `AUTH_RATE_LIMIT_MAX` -> keep `20` (or tighter)
- `API_RATE_LIMIT_WINDOW_MS` -> keep `60000`
- `API_RATE_LIMIT_MAX` -> keep `120` (or tighter)
- `DATASET_STORAGE_PROVIDER` -> **SET** `gcs`
- `GCS_PROJECT_ID` -> **SET** your GCP project id
- `GCS_BUCKET_NAME` -> **SET** your bucket
- `GCS_KEY_FILENAME` -> **LEAVE EMPTY on Cloud Run** (use runtime identity)
- `GCS_DATASET_PREFIX` -> keep `datasets`

Note: `GOOGLE_OAUTH_CLIENT_SECRET` is not used by current backend Google login flow. Do not add it.

## C) ML Service (`services/ml-audit-service`) - Cloud Run env vars

Current service supports:

- Vertex-first inference on `/predict` (when enabled)
- Runtime policy fallback control
- `POST /validate-model` for readiness validation
- Vertex credential/runtime health via `/health`

Set:

- `VERTEX_AI_PROJECT_ID` -> your project id
- `VERTEX_AI_LOCATION` -> usually `us-central1`
- `GEMINI_MODEL` -> keep `gemini-2.5-pro`
- `USE_VERTEX_INFERENCE` -> set `true` in production
- `ALLOW_DETERMINISTIC_FALLBACK` -> set `false` in production
- `VERTEX_TIMEOUT_SECONDS` -> keep `45` unless you need longer timeout

Recommended on Cloud Run:

- Do **not** set `GOOGLE_CLOUD_PRIVATE_KEY*` variables
- Use Cloud Run service account identity + IAM roles

---

## 5) Deploy ML Service to Cloud Run (First)

Deploy first so backend can point `ML_SERVICE_URL` to it.

1. Open GCP -> Cloud Run -> **Create Service**
2. Source:
   - Choose **Deploy from repository**
   - Connect GitHub
   - Select repo + branch
   - Set root directory: `services/ml-audit-service`
3. Build:
   - Use **Buildpacks** (no Dockerfile)
   - Runtime: Python
4. Start command (important for FastAPI):
   - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Authentication:
   - For current backend integration, set **Allow unauthenticated** (backend calls it directly without signed identity token)
6. Add env vars from section 4C
7. Deploy and copy service URL (this is your `ML_SERVICE_URL`)

---

## 6) Deploy Backend to Cloud Run (Second)

1. Cloud Run -> **Create Service**
2. Source:
   - Deploy from GitHub repository
   - Root directory: `server`
3. Build:
   - Buildpacks runtime Node.js
4. Start command:
   - Leave default (`npm start` from `server/package.json`)
5. Authentication:
   - Usually **Allow unauthenticated** (browser calls API)
6. Add all backend env vars from section 4B
7. Deploy and copy backend URL

IAM roles for backend service account:

- For GCS dataset read/write: grant bucket/object role (for example `Storage Object Admin` on target bucket)

---

## 7) Deploy Frontend to Vercel (Third)

1. Vercel -> **Add New Project** -> Import GitHub repo
2. Configure:
   - Root directory: `client`
   - Framework: Vite (auto-detected)
3. Set env vars (section 4A)
4. Deploy
5. Copy Vercel URL

---

## 8) CORS and OAuth Final Update (Critical)

After Vercel URL is known:

1. Update backend `CORS_ORIGIN` to exact frontend domains:
   - production domain
   - custom domain (if used)
2. Redeploy backend Cloud Run revision.

Google OAuth updates:

In Google Cloud Console -> OAuth 2.0 Client:

- Authorized JavaScript origins:
  - `http://localhost:5173` (optional for local dev)
  - `https://<your-vercel-domain>`
  - `https://<your-custom-domain>` (if used)
- Authorized redirect URIs:
  - Add matching domains if your flow needs redirect-based auth

Then keep same Client ID in:

- `VITE_GOOGLE_CLIENT_ID` (Vercel)
- `GOOGLE_OAUTH_CLIENT_ID` (backend)

---

## 9) Post-Deploy Verification Checklist

Replace placeholders and run:

```bash
curl https://<backend-url>/api/v1/health
curl https://<ml-url>/health
curl -X POST https://<ml-url>/validate-model -H "Content-Type: application/json" -d "{\"inputData\":{\"income\":72000,\"credit_score\":730,\"tenure_years\":4}}"
```

Manual checks:

- Sign up/login (email/password)
- Google OAuth login/logout
- Upload dataset (stored in GCS + metadata in Mongo)
- Bias mitigation works only for owner dataset
- Dashboard shows only owner data
- Realtime logs isolated per user

Optional scripted isolation check from this repo:

```bash
node scripts/verify-isolation.js
```

---

## 10) Production Settings Recommended

Use these production-safe defaults:

- `NODE_ENV=production`
- `DB_REQUIRED=true`
- `DATASET_STORAGE_PROVIDER=gcs`
- `ML_ALLOW_MOCK_FALLBACK=false`
- `AUTH_RATE_LIMIT_MAX=20` (or lower)
- `API_RATE_LIMIT_MAX=120` (or lower)
- `USE_VERTEX_INFERENCE=true` (ML service)
- `ALLOW_DETERMINISTIC_FALLBACK=false` (ML service)

---

## 11) Common Mistakes to Avoid

- Setting `CORS_ORIGIN` to localhost in production
- Forgetting to update OAuth origins after deployment
- Putting secrets in Vercel frontend env vars
- Leaving `ML_ALLOW_MOCK_FALLBACK=true` in production
- Leaving `ALLOW_DETERMINISTIC_FALLBACK=true` in ML production runtime
- Committing `.env` files or key files

---

## 12) Quick Change Matrix (Cheat Sheet)

- Keep same:
  - `GEMINI_MODEL` (unless intentionally changing model)
  - `JWT_EXPIRES_IN` (unless policy change)
  - `GCS_DATASET_PREFIX`
- Must change for production:
  - `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `ML_SERVICE_URL`
  - `GEMINI_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`
  - `DATASET_STORAGE_PROVIDER=gcs`, `GCS_PROJECT_ID`, `GCS_BUCKET_NAME`
- Must not set:
  - `GCS_KEY_FILENAME` on Cloud Run (prefer runtime identity)
  - `GOOGLE_OAUTH_CLIENT_SECRET` in frontend (never)

