import { useMemo, useState } from 'react'
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

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
    setResult(null)
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

      const response = await fetch(`${API_BASE_URL}/model/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Model fairness evaluation failed')
      }
      setResult(data.data)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Model Fairness Evaluator</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Evaluate prediction-level fairness across sensitive groups using confusion-based metrics.
        </p>

        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Single combined CSV (prediction + ground truth + features)</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setCombinedFile(event.target.files?.[0] || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            If combined CSV is not provided, upload separate prediction and ground truth files below.
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Predictions CSV (should also include sensitive feature columns)</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setPredictionsFile(event.target.files?.[0] || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Ground truth CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) => setGroundTruthFile(event.target.files?.[0] || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Sensitive attributes (comma-separated)</span>
            <input
              value={sensitiveAttributesInput}
              onChange={(event) => setSensitiveAttributesInput(event.target.value)}
              placeholder="gender,age_group"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Positive outcome</span>
            <input
              value={positiveOutcome}
              onChange={(event) => setPositiveOutcome(event.target.value)}
              placeholder="yes"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">Privileged group map (optional JSON)</span>
            <input
              value={privilegedGroupInput}
              onChange={(event) => setPrivilegedGroupInput(event.target.value)}
              placeholder='{"gender":"male"}'
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-fit rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Evaluating...' : 'Evaluate Model Fairness'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>
        )}
      </article>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm text-slate-600 dark:text-slate-300">Total samples</h3>
              <p className="mt-2 text-2xl font-semibold">{result.summary?.total_samples ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm text-slate-600 dark:text-slate-300">Overall accuracy</h3>
              <p className="mt-2 text-2xl font-semibold">
                {Number(result.accuracy_metrics?.overall_accuracy || 0).toFixed(4)}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm text-slate-600 dark:text-slate-300">Bias score</h3>
              <p className="mt-2 text-2xl font-semibold">{Number(result.bias_score || 0).toFixed(4)}</p>
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  result.risk_level === 'HIGH'
                    ? 'bg-red-100 text-red-700'
                    : result.risk_level === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {result.risk_level}
              </span>
            </article>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">FPR by Group</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fprChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">FNR by Group</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fnrChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Accuracy by Group</h3>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accuracyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Fairness vs Accuracy</h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              Overall accuracy: <strong>{Number(result.fairness_vs_accuracy?.overall_accuracy || 0).toFixed(4)}</strong>
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              Disparity score: <strong>{Number(result.fairness_vs_accuracy?.disparity_score || 0).toFixed(4)}</strong>
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Privileged-group assumptions and sampling metadata are available in the API response under
              <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">assumptions</code>.
            </p>
          </article>
        </>
      )}
    </section>
  )
}

export default ModelEvaluatorPage
