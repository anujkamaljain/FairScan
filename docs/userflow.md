# FairScan End-to-End User Flow (Testing Guide)

This is the complete testing flow you should follow to validate the app end-to-end as a user.

Use this as your QA/demo checklist.

---

## 0) Setup Before Testing

1. Open the app URL (local or deployed frontend).
2. Ensure backend and ML service are reachable.
3. Ensure you have:
   - one test CSV dataset
   - one model evaluation CSV (or separate predictions + ground truth files)
4. Recommended browser: Chrome latest stable.

Expected:

- Landing page loads correctly
- No console/network fatal errors

Pre-flight ML check:

```bash
curl https://<ml-url>/health
curl -X POST https://<ml-url>/validate-model -H "Content-Type: application/json" -d "{\"inputData\":{\"income\":72000,\"credit_score\":730,\"tenure_years\":4}}"
```

Expected:

- `/health` returns `vertex_available: true` in your Vertex-enabled environment
- `/validate-model` returns `valid: true` and `provider: "vertex"` for strict production setup

---

## 1) Authentication Flow

### 1.1 Signup with email/password

1. Go to `/signup`
2. Create a fresh test user
3. Verify redirect to protected area (usually dashboard)

Expected:

- Signup succeeds
- JWT session is established
- Protected routes are accessible

### 1.2 Logout and login

1. Logout from header
2. Go to `/login`
3. Sign in with same credentials

Expected:

- Login succeeds
- User profile appears in header

### 1.3 Google OAuth login (optional but recommended)

1. Logout
2. Login via Google button

Expected:

- Google login works
- Session established in app
- Logout clears session correctly

---

## 2) Dashboard Baseline

1. Visit `/dashboard` right after first login

Expected:

- Empty-state or low-data dashboard (if no analyses run yet)
- No data from other users/accounts visible

---

## 3) Dataset Analysis + Explain + Report + Mitigation

### 3.1 Upload and analyze dataset

1. Open `/datasets`
2. Upload CSV/JSON file
3. Enter:
   - `targetColumn`
   - `sensitiveAttributes` (comma-separated)
   - `positiveOutcome` (if needed)
4. Submit

Expected:

- Analysis returns score/risk/group distributions
- Success alert visible

### 3.2 Generate explanation

1. Click explanation action on same page

Expected:

- Narrative explanation appears
- Suggestions appear (Gemini + rule-based fallback behavior)

### 3.3 Generate report

1. Click generate report
2. Click `Export PDF` (optional)

Expected:

- Overview/findings/risk/recommendations sections appear
- Downloaded PDF opens with the same report sections

### 3.4 Apply mitigation

1. Choose fix type (`REWEIGHT`, `REMOVE_FEATURE`, `BALANCE`)
2. Provide required config (if any)
3. Apply fix

Expected:

- Before/after bias comparison appears
- Improvement values visible
- Persisted mitigation log is generated
- Fixed dataset download button is available

### 3.5 Auto-fix mode (best strategy)

1. Click `Auto Fix (Best Strategy)`
2. Review selected fix type and ranked candidate summary

Expected:

- Best candidate mitigation is auto-selected and applied
- Before/after scores + improvement are returned
- Fixed dataset is downloadable

---

## 4) Model Evaluator Flow

1. Open `/model-evaluator`
2. Provide combined file OR predictions+ground truth files
3. Provide sensitive attributes (+ optional positive outcome/privileged group)
4. Run evaluation

Expected:

- Fairness metrics and bias score/risk returned
- Charts render correctly

Then test:

5. Generate explanation
6. Generate report
7. Export report PDF

Expected:

- Explanation/report generated without breaking the page
- PDF export succeeds with report sections

---

## 5) Realtime Audit Flow

1. Open `/realtime-audit`
2. Provide JSON input
3. Provide sensitive attributes
4. Optionally set outcome/label field name if that column exists in the JSON (it is excluded from the model request)
5. Run prediction with audit (inference uses Vertex; server may fall back to mock when configured)

Expected:

- Prediction returned
- Bias risk and reason code shown
- Realtime explanation shown
- New log entry appears in recent logs
- For strict production profile, verify ML service health and that deterministic mock fallback is disabled where required (`ML_ALLOW_MOCK_FALLBACK=false`)

Then:

6. Generate report from realtime result
7. Export report PDF

Expected:

- Realtime report sections generated
- PDF export works from realtime flow

---

## 6) Reports Page Validation

1. Open `/reports`

Expected:

- Summaries from dataset/model analyses are listed
- Risk badges and concise summaries visible
- No unrelated user data is shown
- Full report sections are generated per flow (dataset/model/realtime) and exportable as PDF from those flow pages

---

## 7) Data Isolation Test (Critical)

Run this with two users (A and B):

1. User A uploads dataset and runs analysis
2. User B logs in separately
3. User B attempts mitigation with User A dataset ID

Expected:

- User B gets not found/denied behavior

Then verify:

4. User A dashboard/logs show A data
5. User B dashboard/logs do not show A data

You can automate this check with:

```bash
node scripts/verify-isolation.js
```

---

## 8) Negative / Error Path Tests

Test these failures intentionally:

- Upload unsupported file extension
- Missing target/sensitive attributes
- Invalid JSON in realtime page
- Invalid/expired token (manually clear token and retry protected API action)

Expected:

- Friendly inline error appears
- No crash, no blank screen

---

## 9) Security/Rate Limit Smoke Checks

1. Rapidly trigger login attempts and sensitive endpoints
2. Confirm 429 behavior appears after threshold

Expected:

- Rate limiting works on auth, dataset, predict-with-audit, explain, report routes

---

## 10) Final Sign-off Checklist

Mark complete only if all are true:

- [ ] Auth (email + Google) works
- [ ] Dataset analysis works
- [ ] Mitigation works
- [ ] Auto-fix works
- [ ] Model evaluator works
- [ ] Realtime audit works
- [ ] Explanations/reports work
- [ ] PDF export works for dataset/model/realtime reports
- [ ] Dashboard and reports render correctly
- [ ] Cross-user isolation is confirmed
- [ ] Build/test scripts pass

If all are checked, the app is end-to-end test-passed for demo/production readiness review.
