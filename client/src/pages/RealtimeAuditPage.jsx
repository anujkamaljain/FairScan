import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyStateCard from '../components/common/EmptyStateCard'
import InlineAlert from '../components/common/InlineAlert'
import RiskBadge from '../components/common/RiskBadge'
import apiFetch from '../lib/api'
import { exportReportPdf } from '../lib/reportPdf'
const workflowSteps = ['Input', 'Predict', 'Bias', 'Explanation']
const pageCardClass =
  'card-scroll rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900'
const subCardClass =
  'card-scroll rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900'
const tileCardClass =
  'card-scroll rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950'
const inputClass =
  'rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
const primaryButtonClass =
  'inline-flex w-fit rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.01] hover:bg-indigo-600 disabled:opacity-50'
const secondaryButtonClass =
  'rounded-xl border border-indigo-400 px-4 py-2 text-sm font-medium text-indigo-600 transition-all duration-200 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500 dark:text-indigo-300 dark:hover:bg-gray-800'
const errorClass =
  'mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'

const defaultJsonInput = `{
  "income": 62000,
  "credit_score": 710,
  "tenure_years": 3,
  "gender": "male",
  "age_group": "26-35"
}`

function RealtimeAuditPage() {
  const [jsonInput, setJsonInput] = useState(defaultJsonInput)
  const [sensitiveAttributesInput, setSensitiveAttributesInput] = useState('gender,age_group')
  const [outcomeFieldInput, setOutcomeFieldInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [explanation, setExplanation] = useState(null)
  const [report, setReport] = useState(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isExportingReport, setIsExportingReport] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const parsedInputPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonInput)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }, [jsonInput])

  const fetchRecentLogs = async () => {
    setLogsLoading(true)
    try {
      const response = await apiFetch('/predict-with-audit/logs')
      const payload = await response.json()
      if (response.ok) {
        setRecentLogs(payload?.data?.logs || [])
      }
    } catch {
      setRecentLogs([])
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentLogs()
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setIsSubmitting(true)
    setExplanation(null)
    setReport(null)
    try {
      const inputData = JSON.parse(jsonInput)
      if (!inputData || typeof inputData !== 'object' || Array.isArray(inputData)) {
        throw new Error('inputData must be a JSON object')
      }
      const sensitiveAttributes = sensitiveAttributesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      if (!sensitiveAttributes.length) {
        throw new Error('Provide at least one sensitive attribute')
      }

      const outcomeField = outcomeFieldInput.trim()
      const response = await apiFetch('/predict-with-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputData,
          sensitiveAttributes,
          ...(outcomeField ? { outcomeField } : {})
        })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Realtime prediction audit failed')
      }
      setResult(payload.data)
      setSuccessMessage('Prediction completed. Generating explanation...')
      void fetchRealtimeExplanation(payload.data)
      void fetchRecentLogs()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const fetchRealtimeExplanation = async (realtimeData) => {
    setIsExplaining(true)
    setError('')
    try {
      const response = await apiFetch('/explain/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(realtimeData)
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to generate realtime explanation')
      }
      setExplanation(payload.data)
      setSuccessMessage('Explanation ready.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsExplaining(false)
    }
  }

  const generateReport = async () => {
    if (!result) return
    setIsGeneratingReport(true)
    setError('')
    try {
      const response = await apiFetch('/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: 'realtime', payload: result })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to generate report')
      }
      setReport(payload.data?.sections || null)
      setSuccessMessage('Report generated successfully.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const exportReport = async () => {
    if (!report) return
    setError('')
    setIsExportingReport(true)
    try {
      exportReportPdf({
        report,
        title: 'Realtime Bias Audit Report',
        subtitle: 'Single-decision fairness and counterfactual assessment',
        generatedFor: 'Realtime Audit',
        meta: {
          'Prediction Label': String(result?.prediction?.label || 'N/A'),
          'Prediction Score': Number(result?.prediction?.score || 0).toFixed(4),
          'Bias Risk': String(result?.bias_risk || 'UNKNOWN'),
          'Reason Code': String(result?.reason_code || 'NONE'),
          ...(result?.outcome_field ? { 'Outcome field (excluded from model)': String(result.outcome_field) } : {})
        }
      })
      setSuccessMessage('Report exported as PDF.')
    } catch (pdfError) {
      setError(pdfError.message)
    } finally {
      setIsExportingReport(false)
    }
  }

  return (
    <section className="space-y-8">
      <article className={pageCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">Realtime Flow</p>
            <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">Realtime Bias-Aware Prediction</h2>
          </div>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Live-ready
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Run prediction and counterfactual sensitivity checks in one request. Inference uses your ML service (Vertex path);
          if the server has mock fallback enabled, transient ML errors fall back automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {workflowSteps.map((step, idx) => (
            <span
              key={step}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                idx === 1
                  ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/30'
                  : 'bg-gray-200/70 text-gray-600 ring-1 ring-gray-300/80 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
              }`}
            >
              {idx + 1}. {step}
            </span>
          ))}
        </div>

        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Input JSON</span>
            <textarea
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              rows={10}
              className={`font-mono text-xs ${inputClass}`}
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <label className="flex min-h-full flex-col gap-2 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-200">Sensitive attributes</span>
              <input
                value={sensitiveAttributesInput}
                onChange={(event) => setSensitiveAttributesInput(event.target.value)}
                className={inputClass}
                placeholder="gender,age_group"
              />
            </label>

            <label className="flex min-h-full flex-col gap-2 text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-200">Outcome / label field (optional)</span>
              <input
                value={outcomeFieldInput}
                onChange={(event) => setOutcomeFieldInput(event.target.value)}
                className={inputClass}
                placeholder="e.g. approved — must match a key in JSON if set"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${primaryButtonClass} w-full justify-center md:w-fit`}
          >
            {isSubmitting ? 'Evaluating...' : 'Predict With Audit'}
          </button>
        </form>

        {(error || successMessage) && (
          <div className="mt-4 space-y-3">
            {error && <InlineAlert tone="error" title="Action failed">{error}</InlineAlert>}
            {successMessage && <InlineAlert tone="success">{successMessage}</InlineAlert>}
          </div>
        )}
      </article>

      {isSubmitting && !result && (
        <article className={subCardClass}>
          <div className="h-28 animate-pulse rounded-xl bg-gray-200/70 dark:bg-gray-800/70" />
        </article>
      )}

      {!result && (
        <EmptyStateCard
          icon="⚡"
          title="Run a prediction to see real-time audit"
          description="Submit input JSON and sensitive attributes to evaluate fairness on the fly."
          hint="Use the sample JSON as a starting point, then test with your own records."
          action={
            <Link
              to="/dashboard"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Back to Dashboard
            </Link>
          }
        />
      )}

      {parsedInputPreview && (
        <article className={subCardClass}>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Input preview</h3>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-100 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {JSON.stringify(parsedInputPreview, null, 2)}
          </pre>
        </article>
      )}

      {result && (
        <article className={subCardClass}>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Realtime Audit Result</h3>
          {result.outcome_field ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Outcome column <span className="font-semibold text-gray-700 dark:text-gray-300">{result.outcome_field}</span>{' '}
              was excluded from the model input (not sent to predict).
            </p>
          ) : null}
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div className={tileCardClass}>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prediction label</p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {result.prediction?.label}
              </p>
            </div>
            <div className={tileCardClass}>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prediction score</p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {Number(result.prediction?.score ?? 0).toFixed(4)}
              </p>
            </div>
            <div className={tileCardClass}>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bias risk</p>
              <RiskBadge level={result.bias_risk} className="mt-1" />
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{result.explanation_hint}</p>
          <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            reason_code: {result.reason_code || 'NONE'}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-gray-700 dark:text-gray-200">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="px-2 py-2">Attribute</th>
                  <th className="px-2 py-2">Original</th>
                  <th className="px-2 py-2">Counterfactual</th>
                  <th className="px-2 py-2" title="Did the model's predicted class change after flipping this attribute?">
                    Label changed (model)
                  </th>
                  <th className="px-2 py-2">Delta score</th>
                </tr>
              </thead>
              <tbody>
                {(result.counterfactual_results || []).map((item) => (
                  <tr
                    key={`${item.sensitive_attribute}-${item.counterfactual_value}`}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-2 py-2">{item.sensitive_attribute}</td>
                    <td className="px-2 py-2">{String(item.original_value)}</td>
                    <td className="px-2 py-2">{String(item.counterfactual_value)}</td>
                    <td className="px-2 py-2">{item.label_changed ? 'Yes' : 'No'}</td>
                    <td className="px-2 py-2">{Number(item.score_delta || 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              &quot;Label changed&quot; compares the model&apos;s output class for the base input vs each counterfactual
              row (sensitive attribute flipped). It is not comparing your optional outcome column in JSON.
            </p>
          </div>
        </article>
      )}

      {result && (
        <article className={subCardClass}>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchRealtimeExplanation(result)}
              disabled={isExplaining}
              className={primaryButtonClass}
            >
              {isExplaining ? 'Explaining...' : 'Explain'}
            </button>
            <button
              type="button"
              onClick={generateReport}
              disabled={isGeneratingReport}
              className={secondaryButtonClass}
            >
              {isGeneratingReport ? 'Generating Report...' : 'Generate Report'}
            </button>
            <button
              type="button"
              onClick={exportReport}
              disabled={!report || isExportingReport}
              className={secondaryButtonClass}
            >
              {isExportingReport ? 'Exporting PDF...' : 'Export PDF'}
            </button>
          </div>

          {explanation && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Why this decision may be biased
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{explanation.explanation}</p>
              <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                {(explanation.summary_points || []).map((point, idx) => (
                  <li key={`sp-${idx}`}>{point}</li>
                ))}
              </ul>
              {Array.isArray(explanation.suggestions) && explanation.suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Suggestions</p>
                  <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                    {explanation.suggestions.map((item, index) => (
                      <li key={`${item.type}-${index}`}>
                        <span className="font-medium">{item.type}:</span> {item.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {report && (
            <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Report</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{report.overview}</p>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Key Findings</p>
                <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                  {(report.key_findings || []).map((point, idx) => (
                    <li key={`kf-${idx}`}>{point}</li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Risk Assessment:</span>{' '}
                {report.risk_assessment}
              </p>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recommendations</p>
                <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                  {(report.recommendations || []).map((point, idx) => (
                    <li key={`rec-${idx}`}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </article>
      )}

      <article className={subCardClass}>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Recent Logs (Last 10)</h3>
        <div className="mt-3 space-y-2">
          {logsLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-gray-200/70 dark:bg-gray-800/70" />
          ) : recentLogs.length ? (
            recentLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{log.prediction?.label}</span>
                  <RiskBadge level={log.bias_risk} />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {new Date(log.createdAt).toLocaleString()} | score {Number(log.prediction?.score || 0).toFixed(4)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">No data available yet</p>
          )}
        </div>
      </article>
    </section>
  )
}

export default RealtimeAuditPage
