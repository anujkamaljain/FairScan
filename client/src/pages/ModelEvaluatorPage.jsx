import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Papa from 'papaparse'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import EmptyStateCard from '../components/common/EmptyStateCard'
import InlineAlert from '../components/common/InlineAlert'
import RiskBadge from '../components/common/RiskBadge'
import apiFetch from '../lib/api'
const workflowSteps = ['Upload', 'Evaluate', 'Explain', 'Compare']
const pageCardClass =
  'card-scroll rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900'
const statCardClass =
  'card-scroll rounded-2xl border border-gray-200/80 bg-gray-50 p-5 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md dark:border-gray-800 dark:bg-gray-900/80'
const subCardClass =
  'card-scroll rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900'
const inputClass =
  'rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
const primaryButtonClass =
  'inline-flex w-fit rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.01] hover:bg-indigo-600 disabled:opacity-50'
const secondaryButtonClass =
  'rounded-xl border border-indigo-400 px-4 py-2 text-sm font-medium text-indigo-600 transition-all duration-200 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500 dark:text-indigo-300 dark:hover:bg-gray-800'
const errorClass =
  'mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300'

const parseCsvFile = (file) =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors?.length) {
          reject(new Error(`CSV parse error: ${result.errors[0].message}`))
          return
        }
        resolve(result.data || [])
      },
      error: (error) => reject(error)
    })
  })

const normalizeKey = (key) => String(key || '').trim().toLowerCase()

const pickColumn = (columns, preferredNames) => {
  const normalizedColumns = columns.map((column) => ({ original: column, normalized: normalizeKey(column) }))
  for (const name of preferredNames) {
    const match = normalizedColumns.find((column) => column.normalized === normalizeKey(name))
    if (match) {
      return match.original
    }
  }
  return columns[0]
}

function ModelEvaluatorPage() {
  const [combinedFile, setCombinedFile] = useState(null)
  const [predictionsFile, setPredictionsFile] = useState(null)
  const [groundTruthFile, setGroundTruthFile] = useState(null)
  const [sensitiveAttributesInput, setSensitiveAttributesInput] = useState('')
  const [positiveOutcome, setPositiveOutcome] = useState('')
  const [privilegedGroupInput, setPrivilegedGroupInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [report, setReport] = useState(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const firstSensitiveAttr = useMemo(
    () => Object.keys(result?.fairness_metrics?.fpr_by_group || {})[0] || null,
    [result]
  )

  const fprChartData = useMemo(() => {
    if (!result || !firstSensitiveAttr) return []
    const fpr = result.fairness_metrics?.fpr_by_group?.[firstSensitiveAttr] || {}
    return Object.entries(fpr).map(([group, value]) => ({ group, value }))
  }, [result, firstSensitiveAttr])

  const fnrChartData = useMemo(() => {
    if (!result || !firstSensitiveAttr) return []
    const fnr = result.fairness_metrics?.fnr_by_group?.[firstSensitiveAttr] || {}
    return Object.entries(fnr).map(([group, value]) => ({ group, value }))
  }, [result, firstSensitiveAttr])

  const accuracyChartData = useMemo(() => {
    if (!result || !firstSensitiveAttr) return []
    const groupAcc = result.accuracy_metrics?.group_accuracy?.[firstSensitiveAttr] || {}
    return Object.entries(groupAcc).map(([group, value]) => ({ group, value }))
  }, [result, firstSensitiveAttr])

  const mostImpactedGroupText = useMemo(() => {
    if (!firstSensitiveAttr || !accuracyChartData.length) {
      return 'Most impacted group: N/A'
    }
    const sorted = [...accuracyChartData].sort((a, b) => a.value - b.value)
    const lowest = sorted[0]
    const highest = sorted[sorted.length - 1]
    const deltaPct = Math.round((lowest.value - highest.value) * 100)
    const label = String(lowest.group).replace(/_/g, ' ')
    return `Most impacted group: ${label.charAt(0).toUpperCase() + label.slice(1)} applicants (${deltaPct}%)`
  }, [accuracyChartData, firstSensitiveAttr])

  const parsePrivilegedGroupInput = () => {
    if (!privilegedGroupInput.trim()) {
      return {}
    }
    try {
      const parsed = JSON.parse(privilegedGroupInput)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('privilegedGroup must be a JSON object')
      }
      return parsed
    } catch {
      throw new Error('privilegedGroup must be valid JSON, e.g. {"gender":"male"}')
    }
  }

  const buildPayloadFromSingleFile = async () => {
    const rows = await parseCsvFile(combinedFile)
    if (!rows.length) {
      throw new Error('Combined CSV has no rows')
    }
    const columns = Object.keys(rows[0])
    const predictionColumn = pickColumn(columns, ['prediction', 'predictions', 'y_pred', 'model_prediction'])
    const truthColumn = pickColumn(columns, ['groundtruth', 'ground_truth', 'actual', 'label', 'y_true'])

    const predictions = rows.map((row) => row[predictionColumn])
    const groundTruth = rows.map((row) => row[truthColumn])
    const features = rows.map((row) => {
      const copy = { ...row }
      delete copy[predictionColumn]
      delete copy[truthColumn]
      return copy
    })

    return { predictions, groundTruth, features }
  }

  const buildPayloadFromSeparateFiles = async () => {
    const predictionRows = await parseCsvFile(predictionsFile)
    const truthRows = await parseCsvFile(groundTruthFile)
    if (!predictionRows.length || !truthRows.length) {
      throw new Error('Predictions and ground truth CSV files must both have rows')
    }
    if (predictionRows.length !== truthRows.length) {
      throw new Error('Predictions and ground truth CSV row counts must match')
    }

    const predColumns = Object.keys(predictionRows[0])
    const truthColumns = Object.keys(truthRows[0])
    const predictionColumn = pickColumn(predColumns, ['prediction', 'predictions', 'y_pred', 'model_prediction'])
    const truthColumn = pickColumn(truthColumns, ['groundtruth', 'ground_truth', 'actual', 'label', 'y_true'])

    const predictions = predictionRows.map((row) => row[predictionColumn])
    const groundTruth = truthRows.map((row) => row[truthColumn])
    const features = predictionRows.map((row) => {
      const copy = { ...row }
      delete copy[predictionColumn]
      return copy
    })

    return { predictions, groundTruth, features }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setResult(null)
    setExplanation(null)
    setReport(null)
    setIsSubmitting(true)

    try {
      const sensitiveAttributes = sensitiveAttributesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      if (!sensitiveAttributes.length) {
        throw new Error('Provide at least one sensitive attribute')
      }

      let payload
      if (combinedFile) {
        payload = await buildPayloadFromSingleFile()
      } else {
        if (!predictionsFile || !groundTruthFile) {
          throw new Error('Provide either a combined file OR both predictions and ground truth files')
        }
        payload = await buildPayloadFromSeparateFiles()
      }

      const body = {
        ...payload,
        sensitiveAttributes,
        positiveOutcome: positiveOutcome.trim() || undefined,
        privilegedGroup: parsePrivilegedGroupInput()
      }

      const response = await apiFetch('/model/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Model fairness evaluation failed')
      }
      setResult(data.data)
      setSuccessMessage('Model fairness evaluation completed. Continue with explanation or report generation.')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateExplanation = async () => {
    if (!result) return
    setIsExplaining(true)
    setError('')
    try {
      const response = await apiFetch('/explain/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to generate explanation')
      }
      setExplanation(payload.data)
      setSuccessMessage('Explanation generated successfully.')
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
        body: JSON.stringify({ report_type: 'model', payload: result })
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

  return (
    <section className="space-y-8">
      <article className={pageCardClass}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">Model Flow</p>
        <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">Model Fairness Evaluator</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Evaluate prediction-level fairness across sensitive groups using confusion-based metrics.
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

        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Single combined CSV (prediction + ground truth + features)</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setCombinedFile(event.target.files?.[0] || null)}
              className={inputClass}
            />
          </label>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            If combined CSV is not provided, upload separate prediction and ground truth files below.
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Predictions CSV (should also include sensitive feature columns)</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setPredictionsFile(event.target.files?.[0] || null)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Ground truth CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setGroundTruthFile(event.target.files?.[0] || null)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Sensitive attributes (comma-separated)</span>
            <input
              value={sensitiveAttributesInput}
              onChange={(event) => setSensitiveAttributesInput(event.target.value)}
              placeholder="gender,age_group"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Positive outcome</span>
            <input
              value={positiveOutcome}
              onChange={(event) => setPositiveOutcome(event.target.value)}
              placeholder="yes"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            <span className="font-medium text-gray-700 dark:text-gray-200">Privileged group map (optional JSON)</span>
            <input
              value={privilegedGroupInput}
              onChange={(event) => setPrivilegedGroupInput(event.target.value)}
              placeholder='{"gender":"male"}'
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${primaryButtonClass} w-full justify-center md:w-fit`}
          >
            {isSubmitting ? 'Evaluating...' : 'Evaluate Model Fairness'}
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
          icon="🧠"
          title="Upload model outputs to evaluate fairness"
          description="Provide combined CSV or separate prediction and ground-truth files to get model fairness metrics."
          hint="After evaluation, generate explanation and report for stakeholder communication."
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

      {result && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <article className={statCardClass}>
              <h3 className="text-sm text-gray-600 dark:text-gray-300">Total samples</h3>
              <p className="mt-2 text-2xl font-semibold">{result.summary?.total_samples ?? 0}</p>
            </article>
            <article className={statCardClass}>
              <h3 className="text-sm text-gray-600 dark:text-gray-300">Overall accuracy</h3>
              <p className="mt-2 text-2xl font-semibold">
                {Number(result.accuracy_metrics?.overall_accuracy || 0).toFixed(4)}
              </p>
            </article>
            <article className={statCardClass}>
              <h3 className="text-sm text-gray-600 dark:text-gray-300">Bias score</h3>
              <p className="mt-2 text-2xl font-semibold">{Number(result.bias_score || 0).toFixed(4)}</p>
              <RiskBadge level={result.risk_level} className="mt-2" />
            </article>
          </div>

          <article className={subCardClass}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{mostImpactedGroupText}</h3>
          </article>

          <div className="grid gap-6 md:grid-cols-3">
            <article className={subCardClass}>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">FPR by Group</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fprChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip formatter={(value) => [Number(value || 0).toFixed(4), 'FPR']} />
                    <Bar dataKey="value" fill="#f59e0b" isAnimationActive animationDuration={450} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={subCardClass}>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">FNR by Group</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fnrChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip formatter={(value) => [Number(value || 0).toFixed(4), 'FNR']} />
                    <Bar dataKey="value" fill="#ef4444" isAnimationActive animationDuration={450} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={subCardClass}>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Accuracy by Group</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accuracyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip formatter={(value) => [Number(value || 0).toFixed(4), 'Accuracy']} />
                    <Bar dataKey="value" fill="#10b981" isAnimationActive animationDuration={450} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <article className={subCardClass}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Fairness vs Accuracy</h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
              Overall accuracy: <strong>{Number(result.fairness_vs_accuracy?.overall_accuracy || 0).toFixed(4)}</strong>
            </p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
              Disparity score: <strong>{Number(result.fairness_vs_accuracy?.disparity_score || 0).toFixed(4)}</strong>
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Privileged-group assumptions and sampling metadata are available in the API response under
              <code className="ml-1 rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">assumptions</code>.
            </p>
          </article>

          <article className={subCardClass}>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateExplanation}
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
            </div>

            {explanation && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Explanation</h4>
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
        </>
      )}
    </section>
  )
}

export default ModelEvaluatorPage
