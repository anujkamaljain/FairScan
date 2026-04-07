import { useMemo, useState } from 'react'
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

function DatasetsPage() {
  const [file, setFile] = useState(null)
  const [targetColumn, setTargetColumn] = useState('')
  const [sensitiveAttributes, setSensitiveAttributes] = useState('')
  const [positiveOutcome, setPositiveOutcome] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const sensitiveKeys = useMemo(
    () => Object.keys(result?.group_distributions || {}),
    [result]
  )
  const selectedSensitiveAttr = sensitiveKeys[0] || null

  const demographicData = useMemo(() => {
    if (!result || !selectedSensitiveAttr) {
      return []
    }

    const groupRates =
      result.bias_metrics?.demographic_parity?.[selectedSensitiveAttr]
        ?.group_rates || {}
    return Object.entries(groupRates).map(([group, stats]) => ({
      group,
      rate: Number((stats.rate ?? 0).toFixed(4))
    }))
  }, [result, selectedSensitiveAttr])

  const distributionData = useMemo(() => {
    if (!result || !selectedSensitiveAttr) {
      return []
    }

    const distribution = result.group_distributions?.[selectedSensitiveAttr] || {}
    return Object.entries(distribution).map(([group, stats]) => ({
      group,
      positive: stats.positive ?? 0,
      negative: stats.negative ?? 0
    }))
  }, [result, selectedSensitiveAttr])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setResult(null)

    if (!file) {
      setError('Please select a CSV or JSON dataset file.')
      return
    }
    if (!targetColumn.trim()) {
      setError('Target column is required.')
      return
    }
    if (!sensitiveAttributes.trim()) {
      setError('At least one sensitive attribute is required.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('targetColumn', targetColumn.trim())
      formData.append('sensitiveAttributes', sensitiveAttributes.trim())
      if (positiveOutcome.trim()) {
        formData.append('positiveOutcome', positiveOutcome.trim())
      }

      const response = await fetch(`${API_BASE_URL}/datasets/upload-and-analyze`, {
        method: 'POST',
        body: formData
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Dataset analysis failed')
      }
      setResult(payload.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Dataset Bias Analyzer</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload a dataset and compute fairness metrics against selected sensitive attributes.
        </p>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Dataset file (CSV or JSON)</span>
            <input
              type="file"
              accept=".csv,.json"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Target column</span>
            <input
              value={targetColumn}
              onChange={(event) => setTargetColumn(event.target.value)}
              placeholder="e.g. approved"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Sensitive attributes</span>
            <input
              value={sensitiveAttributes}
              onChange={(event) => setSensitiveAttributes(event.target.value)}
              placeholder="e.g. gender,age_group"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Positive outcome (optional)</span>
            <input
              value={positiveOutcome}
              onChange={(event) => setPositiveOutcome(event.target.value)}
              placeholder="e.g. yes"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Analyzing...' : 'Upload and Analyze'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-600">Rows</h3>
              <p className="mt-2 text-2xl font-semibold">{result.dataset_summary?.rows ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-600">Columns</h3>
              <p className="mt-2 text-2xl font-semibold">{result.dataset_summary?.columns ?? 0}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-600">Bias Score</h3>
              <p className="mt-2 text-2xl font-semibold">{(result.bias_score ?? 0).toFixed(4)}</p>
              <p
                className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  result.risk_level === 'HIGH'
                    ? 'bg-red-100 text-red-700'
                    : result.risk_level === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {result.risk_level}
              </p>
            </article>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Group Positive Rate Comparison</h3>
              <p className="mt-1 text-sm text-slate-600">
                {selectedSensitiveAttr
                  ? `Sensitive attribute: ${selectedSensitiveAttr}`
                  : 'No group data available'}
              </p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demographicData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Bar dataKey="rate" name="Positive rate" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Outcome Distribution by Group</h3>
              <p className="mt-1 text-sm text-slate-600">Positive vs negative outcomes per group</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="positive" stackId="a" name="Positive" fill="#16a34a" />
                    <Bar dataKey="negative" stackId="a" name="Negative" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold">Flagged Proxy Features</h3>
            {result.flagged_features?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-2 py-2 font-medium">Feature</th>
                      <th className="px-2 py-2 font-medium">Sensitive Attribute</th>
                      <th className="px-2 py-2 font-medium">Correlation</th>
                      <th className="px-2 py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.flagged_features.map((item) => (
                      <tr key={`${item.feature}-${item.sensitive_attribute}`} className="border-b border-slate-100">
                        <td className="px-2 py-2">{item.feature}</td>
                        <td className="px-2 py-2">{item.sensitive_attribute}</td>
                        <td className="px-2 py-2">{item.correlation}</td>
                        <td className="px-2 py-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              item.risk === 'HIGH'
                                ? 'bg-red-100 text-red-700'
                                : item.risk === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {item.risk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No highly correlated proxy features were flagged.</p>
            )}
          </article>
        </>
      )}
    </section>
  )
}

export default DatasetsPage
