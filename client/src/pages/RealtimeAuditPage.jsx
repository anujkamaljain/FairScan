import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

const defaultJsonInput = `{
  "income": 62000,
  "credit_score": 710,
  "tenure_years": 3,
  "gender": "male",
  "age_group": "26-35"
}`

const riskBadgeStyles = {
  LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
}

function RealtimeAuditPage() {
  const [jsonInput, setJsonInput] = useState(defaultJsonInput)
  const [sensitiveAttributesInput, setSensitiveAttributesInput] = useState('gender,age_group')
  const [modelType, setModelType] = useState('mock')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])

  const parsedInputPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonInput)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }, [jsonInput])

  const fetchRecentLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/predict-with-audit/logs`)
      const payload = await response.json()
      if (response.ok) {
        setRecentLogs(payload?.data?.logs || [])
      }
    } catch {
      setRecentLogs([])
    }
  }

  useEffect(() => {
    fetchRecentLogs()
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
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

      const response = await fetch(`${API_BASE_URL}/predict-with-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputData,
          sensitiveAttributes,
          modelConfig: { type: modelType }
        })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Realtime prediction audit failed')
      }
      setResult(payload.data)
      await fetchRecentLogs()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Realtime Bias-Aware Prediction</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Run prediction and counterfactual sensitivity checks in a single API call.
        </p>

        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Input JSON</span>
            <textarea
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              rows={10}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">Sensitive attributes</span>
              <input
                value={sensitiveAttributesInput}
                onChange={(event) => setSensitiveAttributesInput(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="gender,age_group"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Model type</span>
              <select
                value={modelType}
                onChange={(event) => setModelType(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="mock">mock</option>
                <option value="vertex">vertex</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-fit rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Evaluating...' : 'Predict With Audit'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
      </article>

      {parsedInputPreview && (
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Input preview</h3>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {JSON.stringify(parsedInputPreview, null, 2)}
          </pre>
        </article>
      )}

      {result && (
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Realtime Audit Result</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs text-slate-500 dark:text-slate-400">Prediction label</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {result.prediction?.label}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs text-slate-500 dark:text-slate-400">Prediction score</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                {Number(result.prediction?.score ?? 0).toFixed(4)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs text-slate-500 dark:text-slate-400">Bias risk</p>
              <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${riskBadgeStyles[result.bias_risk]}`}>
                {result.bias_risk}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{result.explanation_hint}</p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-2 py-2">Attribute</th>
                  <th className="px-2 py-2">Original</th>
                  <th className="px-2 py-2">Counterfactual</th>
                  <th className="px-2 py-2">Label changed</th>
                  <th className="px-2 py-2">Delta score</th>
                </tr>
              </thead>
              <tbody>
                {(result.counterfactual_results || []).map((item) => (
                  <tr
                    key={`${item.sensitive_attribute}-${item.counterfactual_value}`}
                    className="border-b border-slate-100 dark:border-slate-800"
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
          </div>
        </article>
      )}

      <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent Logs (Last 10)</h3>
        <div className="mt-3 space-y-2">
          {recentLogs.length ? (
            recentLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{log.prediction?.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskBadgeStyles[log.bias_risk]}`}>
                    {log.bias_risk}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {new Date(log.createdAt).toLocaleString()} | score {Number(log.prediction?.score || 0).toFixed(4)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">No realtime audit logs yet.</p>
          )}
        </div>
      </article>
    </section>
  )
}

export default RealtimeAuditPage
