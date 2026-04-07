# FairScan

Production-grade fairness auditing platform with a React frontend and Express backend.

## Tech Stack

- `client/`: React + Vite + TailwindCSS + Recharts
- `server/`: Node.js + Express + MongoDB + JWT auth
- AI integrations:
  - Gemini for explainability/report generation
  - External ML inference service via `ML_SERVICE_URL`
- Auth:
  - Email/password
  - Google OAuth (`@react-oauth/google` + backend token verification)
- Storage:
  - Dataset records in MongoDB
  - Dataset file storage provider support: `local` or `gcs`

## Project Structure

- `client/` frontend app
- `server/` API + business logic + persistence
- `scripts/` repository-level utility scripts

## Prerequisites

- Node.js 20+ (Node 22 works)
- npm 10+
- MongoDB (local or Atlas)
- Optional: Google Cloud project + GCS bucket (for dataset file storage)

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure backend environment

Copy `server/.env.example` to `server/.env`, then set values.

Core required values:

- `MONGO_URI`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `ML_SERVICE_URL`
- `GEMINI_API_KEY` (if using Gemini endpoints)
- `GOOGLE_OAUTH_CLIENT_ID` (if using Google login)

Dataset storage options:

- Local mode (default):
  - `DATASET_STORAGE_PROVIDER=local`
- GCS mode:
  - `DATASET_STORAGE_PROVIDER=gcs`
  - `GCS_BUCKET_NAME=<your-bucket>`
  - `GCS_PROJECT_ID=<your-project-id>` (recommended)
  - `GCS_KEY_FILENAME=<path-to-service-account-json>` (optional when ADC/workload identity is used)
  - `GCS_DATASET_PREFIX=datasets`

### 3) Configure frontend environment

Create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_GOOGLE_CLIENT_ID=<same-google-web-client-id>
```

## Run Locally

Backend:

```bash
npm run dev:server
```

Frontend:

```bash
npm run dev:client
```

App URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/v1/health`

## API Overview

Base URL: `/api/v1`

- Public:
  - `GET /health`
  - `POST /auth/login`
  - `POST /auth/signup`
  - `POST /auth/google`
- Auth required:
  - `POST /datasets/upload-and-analyze`
  - `POST /model/evaluate`
  - `POST /predict-with-audit`
  - `POST /explain`
  - `POST /report`
  - `POST /bias/apply-fix`
  - `GET /dashboard/summary` (supports optional auth, richer response with auth)

## Dataset Upload Example

```bash
curl -X POST "http://localhost:5000/api/v1/datasets/upload-and-analyze" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@server/samples/loan_approval_balanced.csv" \
  -F "targetColumn=approved" \
  -F "sensitiveAttributes=gender,age_group" \
  -F "positiveOutcome=yes"
```

When `DATASET_STORAGE_PROVIDER=gcs`, uploaded dataset files are stored in GCS and file metadata is saved in MongoDB (`Dataset.fileStorage`).

## Build / Start

```bash
npm run build:client
npm run start:server
```

## Security Notes

- Do not commit `.env` files or service account keys.
- Rotate any credential that has been exposed.
- Keep `JWT_SECRET` strong and unique in production.
- Use `npm run security:check-secrets` before commits/releases.
