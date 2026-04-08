# FairScan Features and Google Technology Mapping

This file lists the key app features, which Google technologies are used, and why they are used.

## 1) Authentication (Email + Google OAuth)

- **User feature**: Sign up/login with email/password or Google.
- **Where in app**: Login/Signup pages + protected app routes.
- **Google technologies**:
  - `@react-oauth/google` (frontend): renders Google login and obtains ID token.
  - `google-auth-library` (backend): verifies Google ID token server-side.
- **Use case**:
  - Fast onboarding for users.
  - Secure token verification before issuing platform JWT.

## 2) Dataset Upload and Bias Analysis

- **User feature**: Upload CSV/JSON, select target and sensitive attributes, run fairness analysis.
- **Where in app**: `Datasets` page.
- **Google technologies**:
  - **Google Cloud Storage (GCS)** via `@google-cloud/storage` (backend).
- **Use case**:
  - Store large uploaded datasets in object storage.
  - Keep metadata and analysis artifacts in MongoDB.
  - Surface proxy/correlation insights via dedicated heatmap + flagged-feature table.

## 3) Bias Mitigation

- **User feature**: Apply mitigation strategies and compare before-vs-after scores.
- **Where in app**: `Datasets` page (after analysis).
- **Google technologies**:
  - Uses GCS-backed dataset retrieval when snapshot is not stored locally.
- **Use case**:
  - Supports production storage model where raw rows are not always embedded in DB.
  - Allows users to download the transformed fixed dataset for downstream use.

### 3.1) Auto-Bias Correction Engine

- **User feature**: Auto-select best mitigation strategy (`REWEIGHT`, `BALANCE`, `REMOVE_FEATURE`) by measured fairness improvement.
- **Where in app**: `Datasets` page -> `Auto Fix (Best Strategy)`.
- **Google technologies**:
  - Uses GCS-backed dataset retrieval when snapshots are not stored locally (same as manual mitigation).
- **Use case**:
  - Reduces manual trial-and-error while keeping deterministic, auditable strategy selection.
  - Returns ranked candidate strategies and selected rationale.

## 4) Model Fairness Evaluation

- **User feature**: Evaluate model fairness using predictions, ground truth, and features.
- **Where in app**: `Model Evaluator` page.
- **Google technologies**:
  - No direct Google API call required for core fairness math.
  - Uses platform storage/logging and optional Gemini for explanation.
- **Use case**:
  - Measure fairness disparities and risk levels across groups.

## 5) Realtime Prediction Audit

- **User feature**: Send one record, get prediction + fairness risk + reason codes.
- **Where in app**: `Realtime Audit` page.
- **Google technologies**:
  - Vertex AI REST model invocation via ML service (`services/ml-audit-service`).
  - Google-auth ADC/service-account flow used by ML service for Vertex token.
  - ML service deployed on **Cloud Run**.
- **Use case**:
  - Fairness-aware decisioning for live inference workflows.
  - Realtime audit always calls the Vertex ML-service path; mock is server-only fallback when `ML_ALLOW_MOCK_FALLBACK=true` and the ML service errors.
  - Optional outcome/label key strips that column from the model request; counterfactual “label changed” reflects the model output class, not the JSON label.

## 6) Explainability (Dataset / Model / Realtime)

- **User feature**: Convert numeric fairness outputs into clear narrative explanations and fix suggestions.
- **Where in app**: Dataset, Model, Realtime pages.
- **Google technologies**:
  - `@google/genai` (Gemini API) in backend.
- **Use case**:
  - Improve stakeholder communication (product, compliance, leadership).
  - Provide concise AI-generated recommendations grounded in computed metrics.

## 7) Structured Fairness Reports

- **User feature**: Generate report sections: overview, key findings, risk, recommendations.
- **Where in app**: Reports page and per-feature report actions.
- **Google technologies**:
  - Gemini API via backend `geminiService`.
- **Use case**:
  - Produce consistent report narratives from technical results.
  - Export professional PDF reports directly from dataset/model/realtime pages.

## 8) Dashboard and Risk Monitoring

- **User feature**: View overall bias score, risk level, and chart summaries.
- **Where in app**: `Dashboard` page.
- **Google technologies**:
  - Indirect: surfaces data created by GCS-backed analyses and Gemini-enhanced outputs.
- **Use case**:
  - Executive overview and rapid operational monitoring.

## 9) Account/Owner Data Isolation

- **User feature**: Each account sees and modifies only its own fairness data.
- **Where in app**: Dashboard, mitigation, realtime logs, report summaries.
- **Google technologies**:
  - Supports isolation even with GCS object storage through owner-linked metadata.
- **Use case**:
  - Multi-tenant safety and privacy.

## 10) Security and Reliability Controls

- **User feature impact**: safer API behavior under production load.
- **Google technologies**:
  - Cloud Run runtime + IAM identity model (recommended for service-to-resource access).
- **Platform controls implemented**:
  - Rate limiting on auth, dataset, predict-with-audit, explain, report
  - JWT auth and route protection
  - Config validation in production mode
  - Owner-scoped fixed dataset downloads and owner-scoped mitigation actions

---

## Google Technology Summary Table

| Google technology | Used where | Why |
|---|---|---|
| Google OAuth (Web Client ID) | Frontend login + backend token verify | User sign-in without password flow |
| `google-auth-library` | Backend auth service | Verify Google ID token securely |
| Gemini API (`@google/genai`) | Backend explain/report services | Narrative explainability + recommendations |
| Google Cloud Storage | Backend dataset storage service | Store uploaded files at scale |
| Cloud Run | Backend + ML service deployment target | Managed serverless runtime |
| Vertex AI (generateContent endpoint) | ML service `/predict` and `/validate-model` | Real model-backed inference with readiness validation |
