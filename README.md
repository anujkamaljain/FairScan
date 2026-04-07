# FairSight AI

Production-grade monorepo scaffold for an AI fairness platform.

## Monorepo Structure

- `client/` React + Vite + TailwindCSS frontend
- `server/` Express + MongoDB backend API
- `services/` Optional FastAPI microservices for ML-specific workloads

## Quick Start

### 1) Install Dependencies

```bash
npm install
```

### 2) Configure Backend Environment

Copy `server/.env.example` to `server/.env` and update values.

### 3) Run Backend

```bash
npm run dev:server
```

API health endpoint:
`GET http://localhost:5000/api/v1/health`

### 4) Run Frontend

```bash
npm run dev:client
```

Frontend runs on Vite default port:
`http://localhost:5173`

## Dataset Bias Analyzer API

Endpoint:
`POST http://localhost:5000/api/v1/datasets/upload-and-analyze`

Multipart fields:
- `file` (CSV or JSON)
- `targetColumn` (string)
- `sensitiveAttributes` (comma-separated or JSON array string)
- `positiveOutcome` (optional, recommended if target values are not binary-like)

Example:

```bash
curl -X POST "http://localhost:5000/api/v1/datasets/upload-and-analyze" \
  -F "file=@server/samples/loan_approval_sample.csv" \
  -F "targetColumn=approved" \
  -F "sensitiveAttributes=gender,age_group" \
  -F "positiveOutcome=yes"
```
