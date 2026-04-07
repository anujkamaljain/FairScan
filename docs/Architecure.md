# FairScan Product Architecture

This document explains the end-to-end architecture of FairScan: what technology is used, how each major feature works internally, and why each part exists.

## 1) High-Level System

FairScan is a 3-tier system:

- **Frontend (`client`)**: React + Vite single-page application
- **Backend API (`server`)**: Node.js + Express + MongoDB
- **ML microservice (`services/ml-audit-service`)**: FastAPI service for `/predict`

Data and external services:

- **MongoDB**: stores users, datasets, reports, and audit logs
- **Google Cloud Storage (GCS)**: stores uploaded dataset files (when `DATASET_STORAGE_PROVIDER=gcs`)
- **Google OAuth**: user sign-in via Google ID token
- **Gemini API**: narrative explainability/report generation

---

## 2) Frontend Architecture

Core stack:

- React 19
- React Router (browser router)
- Tailwind CSS
- Recharts for charts
- `@react-oauth/google` for Google sign-in button/flow

Routing:

- Public routes: `/`, `/login`, `/signup`
- Protected routes: `/dashboard`, `/datasets`, `/model-evaluator`, `/realtime-audit`, `/reports`
- Protection is done by `ProtectedRoute`, and authenticated routes are wrapped by `AppShell`.

State management:

- `AuthContext` manages token + user persistence in `localStorage`
- `ThemeContext` manages dark/light mode
- API helper (`client/src/lib/api.js`) auto-attaches JWT as `Authorization: Bearer <token>`

UX behavior:

- Every main feature page follows a form-driven workflow
- Result panels, alerts, empty states, and charts are rendered from backend responses
- Dashboard aggregates risk and activity for quick executive-level monitoring

---

## 3) Backend API Architecture

Core stack:

- Node.js (CommonJS)
- Express
- Mongoose (MongoDB)
- JWT auth
- Helmet, CORS, Morgan (security + observability)
- Express rate limiter on high-risk routes

Request lifecycle:

1. Request enters Express app
2. Security middleware (helmet/cors/rate limit) runs
3. Route-level auth middleware validates JWT where required
4. Controller validates payload and calls service layer
5. Service executes domain logic (fairness analysis, mitigation, explainability, logging)
6. Standardized success/error response is returned

Major route groups:

- `/api/v1/auth`: signup, login, Google login
- `/api/v1/datasets`: upload + analyze dataset
- `/api/v1/model`: model fairness evaluation
- `/api/v1/predict-with-audit`: realtime bias-aware prediction and logs
- `/api/v1/explain`: explain dataset/model/realtime payloads
- `/api/v1/report`: structured narrative report generation
- `/api/v1/bias`: mitigation fix application
- `/api/v1/dashboard`: scoped summary for current user

---

## 4) Data Ownership & Isolation Model

FairScan enforces account isolation in persisted analysis flows:

- Dataset records store `ownerId`
- Bias reports store `generatedBy`
- Model/realtime/mitigation logs store `actorId`
- Mitigation uses owner-scoped dataset lookup (`_id + ownerId`)
- Dashboard summary and realtime logs are filtered by current authenticated actor

Impact:

- User B cannot apply mitigation to User A dataset
- User B cannot see User A dashboard/reporting/log data in these scoped flows

---

## 5) Dataset Analysis Flow (How It Works)

Feature goal:

- Upload CSV/JSON dataset and compute fairness metrics by sensitive groups

Technical flow:

1. Frontend sends multipart form (`file`, `targetColumn`, `sensitiveAttributes`, optional `positiveOutcome`)
2. Backend parses and normalizes file rows (`datasetIngestionService`)
3. Fairness metrics are computed (`biasAnalysisService`)
4. Persistence:
   - `Dataset` document created (metadata + storage metadata)
   - `BiasReport` document created
5. Storage model:
   - If local storage: `dataSnapshot` stores rows
   - If GCS storage: file is uploaded to GCS; `dataSnapshot` is minimized

Why this design:

- Keeps fairness math deterministic and auditable
- Supports production-scale file storage with GCS

---

## 6) Mitigation Flow

Feature goal:

- Apply deterministic mitigation (`REWEIGHT`, `REMOVE_FEATURE`, `BALANCE`) and compare before-vs-after

Technical flow:

1. Backend receives datasetId + fixType + config
2. Dataset is owner-validated
3. Dataset rows are loaded:
   - from `dataSnapshot`, or
   - from GCS object (download + parse) when snapshot is not persisted
4. Bias metrics computed before and after fix
5. Improvement summary returned and mitigation log persisted

Why this design:

- Works with both local and GCS-backed storage
- Prevents cross-account dataset tampering

---

## 7) Model Evaluator Flow

Feature goal:

- Evaluate model fairness from predictions + ground truth + feature context

Technical flow:

1. Frontend builds payload from CSV(s)
2. Backend computes:
   - confusion matrices by group
   - FPR/FNR disparities
   - equal opportunity and predictive parity signals
   - composite bias score and risk level
3. Results persisted in `ModelAuditLog` with actor context

Why this design:

- Gives both fairness and accuracy tradeoff visibility
- Produces machine-consumable + executive-readable metrics

---

## 8) Realtime Audit Flow

Feature goal:

- Audit single prediction requests for fairness risk in near real time

Technical flow:

1. Frontend sends `inputData`, `sensitiveAttributes`, and model config (`mock`/`vertex`)
2. Backend performs inference via model inference service
3. Counterfactual bias checks compute risk/reason codes
4. Audit event is queued and persisted to logs
5. Frontend can fetch latest logs for current user

Resilience behavior:

- ML service `/predict` is Vertex-first when `USE_VERTEX_INFERENCE=true`
- Deterministic fallback only occurs if `ALLOW_DETERMINISTIC_FALLBACK=true`
- `/validate-model` endpoint can be used to verify provider/health before production cutover

---

## 9) Explainability & Reporting

Feature goal:

- Convert metric-heavy outputs into human-readable fairness narratives

Technical flow:

1. Explain/report endpoints accept payloads from dataset/model/realtime flows
2. `explainabilityService` builds structured inputs and rule-based suggestions
3. `geminiService` calls Gemini with strict JSON prompts
4. Retry + timeout + fallback logic ensures graceful degradation
5. Optional webhook alert can fire when Gemini fallback occurs

Why this design:

- Keeps business/compliance messaging consistent
- Avoids hard failure if LLM call times out/unavailable

---

## 10) Security & Operational Controls

- JWT-based API auth for protected routes
- CORS allowlist from env (`CORS_ORIGIN`)
- Helmet + centralized error handling
- Rate limiting on auth, dataset upload, prediction, explain/report routes
- Secret tracking check script to prevent accidental commits
- Environment validation in production (JWT, Mongo URI, ML URL, CORS, etc.)

---

## 11) Deployment Architecture

Recommended production shape:

- Frontend: Vercel
- Backend API: Cloud Run
- ML service: Cloud Run
- MongoDB Atlas for DB
- GCS for dataset files

Important runtime configuration links backend + ML + frontend:

- Frontend `VITE_API_BASE_URL` -> backend URL
- Backend `ML_SERVICE_URL` -> ML service URL
- Backend `CORS_ORIGIN` -> Vercel domain(s)

---

## 12) Why This Architecture Fits FairScan

- **Separation of concerns**: UI, business API, and ML runtime are independent
- **Scalable storage**: file objects in GCS, metadata in Mongo
- **Auditability**: logs and reports persisted per flow
- **Isolation-ready**: owner/actor scoping protects user data visibility
- **Demo + production flexibility**: mock capability for demos, strict mode for production
