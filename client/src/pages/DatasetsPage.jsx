import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { exportReportPdf } from '../lib/reportPdf'
const workflowSteps = ['Upload', 'Analyze', 'Explain', 'Apply Fix', 'Compare']
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
const heatmapBucket = ['Low', 'Medium', 'High']

function DatasetsPage() {
  const [file, setFile] = useState(null)
  const [targetColumn, setTargetColumn] = useState('')
  const [sensitiveAttributes, setSensitiveAttributes] = useState('')
  const [positiveOutcome, setPositiveOutcome] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [report, setReport] = useState(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isExportingReport, setIsExportingReport] = useState(false)
  const [fixType, setFixType] = useState('REWEIGHT')
  const [fixFeature, setFixFeature] = useState('')
  const [fixMethod, setFixMethod] = useState('oversample')
  const [isApplyingFix, setIsApplyingFix] = useState(false)
  const [isAutoApplyingFix, setIsAutoApplyingFix] = useState(false)
  const [isDownloadingFixedDataset, setIsDownloadingFixedDataset] = useState(false)
  const [fixResult, setFixResult] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

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

  const featureCorrelationHeatmap = useMemo(() => {
    if (!result) {
      return { features: [], sensitive: [], values: {}, source: 'none' }
    }

    const values = {}
    const featureSet = new Set()
    const sensitiveSet = new Set()
    const keyFor = (feature, sensitiveAttr) => `${feature}::${sensitiveAttr}`

    ;(result.flagged_features || []).forEach((entry) => {
      const feature = String(entry?.feature || '').trim()
      const sensitiveAttr = String(entry?.sensitive_attribute || '').trim()
      const correlation = Number(entry?.correlation)
      if (!feature || !sensitiveAttr || !Number.isFinite(correlation)) return

      featureSet.add(feature)
      sensitiveSet.add(sensitiveAttr)
      const key = keyFor(feature, sensitiveAttr)
      values[key] = Math.max(values[key] || 0, Number(Math.abs(correlation).toFixed(4)))
    })

    let source = 'flagged_features'

    // If flagged pairs are sparse/none, backfill from numeric correlation matrix.
    if (!featureSet.size || !sensitiveSet.size) {
      const matrix = result.bias_metrics?.numeric_correlation_matrix || {}
      const matrixColumns = Object.keys(matrix)
      const numericSensitive = sensitiveKeys.filter((attr) => matrixColumns.includes(attr))

      numericSensitive.forEach((sensitiveAttr) => {
        sensitiveSet.add(sensitiveAttr)
        matrixColumns.forEach((feature) => {
          if (feature === sensitiveAttr || feature === targetColumn) return
          const direct = Number(matrix?.[feature]?.[sensitiveAttr])
          const reverse = Number(matrix?.[sensitiveAttr]?.[feature])
          const raw = Number.isFinite(direct) ? direct : reverse
          if (!Number.isFinite(raw)) return
          featureSet.add(feature)
          values[keyFor(feature, sensitiveAttr)] = Number(Math.abs(raw).toFixed(4))
        })
      })

      if (featureSet.size && sensitiveSet.size) {
        source = 'numeric_correlation_matrix'
      }
    }

    const sensitive = [...sensitiveSet]
    const maxForFeature = (feature) =>
      sensitive.reduce((max, sensitiveAttr) => {
        const value = values[keyFor(feature, sensitiveAttr)] || 0
        return Math.max(max, value)
      }, 0)

    const features = [...featureSet].sort((a, b) => maxForFeature(b) - maxForFeature(a))

    return { features, sensitive, values, source }
  }, [result, sensitiveKeys, targetColumn])

  const heatCell = (value) => {
    if (!Number.isFinite(value)) {
      return {
        className:
          'rounded-md border border-dashed border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500',
        style: {},
        text: '—'
      }
    }

    const clamped = Math.max(0, Math.min(1, value))
    const style = {
      backgroundColor: `rgba(99, 102, 241, ${0.1 + clamped * 0.62})`,
      borderColor: `rgba(99, 102, 241, ${0.25 + clamped * 0.5})`
    }
    return {
      className: `rounded-md border px-2 py-2 text-center text-xs font-semibold ${
        clamped >= 0.5 ? 'text-white' : 'text-gray-800 dark:text-gray-100'
      }`,
      style,
      text: value.toFixed(3)
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setResult(null)
    setExplanation(null)
    setReport(null)
    setFixResult(null)

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

      const response = await apiFetch('/datasets/upload-and-analyze', {
        method: 'POST',
        body: formData
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Dataset analysis failed')
      }
      setResult(payload.data)
      setSuccessMessage('Dataset analysis completed. Review bias metrics and proceed to explanation or mitigation.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateExplanation = async () => {
    if (!result) return
    setIsExplaining(true)
    setError('')
    try {
      const response = await apiFetch('/explain/dataset', {
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
        body: JSON.stringify({ report_type: 'dataset', payload: result })
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
        title: 'Dataset Bias Report',
        subtitle: 'Fairness analysis summary for uploaded dataset',
        generatedFor: 'Dataset Analyzer',
        meta: {
          'Risk Level': result?.risk_level || 'UNKNOWN',
          'Bias Score': Number(result?.bias_score || 0).toFixed(4),
          Rows: String(result?.dataset_summary?.rows || 0),
          Columns: String(result?.dataset_summary?.columns || 0)
        }
      })
      setSuccessMessage('Report exported as PDF.')
    } catch (pdfError) {
      setError(pdfError.message)
    } finally {
      setIsExportingReport(false)
    }
  }

  const applyFix = async () => {
    const datasetId = result?.persisted?.dataset_id
    if (!datasetId) {
      setError('Dataset ID unavailable. Re-run analysis before applying fix.')
      return
    }

    setIsApplyingFix(true)
    setError('')
    try {
      const config = {}
      if (fixType === 'REMOVE_FEATURE') {
        if (!fixFeature.trim()) {
          throw new Error('Feature is required for REMOVE_FEATURE')
        }
        config.feature = fixFeature.trim()
      }
      if (fixType === 'BALANCE') {
        config.method = fixMethod
      }

      const response = await apiFetch('/bias/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          fixType,
          config
        })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to apply fix')
      }
      setFixResult(payload.data)
      setSuccessMessage('Mitigation applied. Compare before vs after results below.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsApplyingFix(false)
    }
  }

  const autoApplyFix = async () => {
    const datasetId = result?.persisted?.dataset_id
    if (!datasetId) {
      setError('Dataset ID unavailable. Re-run analysis before applying auto-fix.')
      return
    }

    setIsAutoApplyingFix(true)
    setError('')
    try {
      const response = await apiFetch('/bias/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId,
          config: {
            positiveOutcome: positiveOutcome.trim() || undefined
          }
        })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to auto-apply fix')
      }
      setFixResult(payload.data)
      const selectedFix = payload.data?.auto_fix?.selected?.fix_type || payload.data?.applied_fix?.type || 'AUTO'
      setSuccessMessage(`Auto-fix selected ${selectedFix} and completed mitigation analysis.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsAutoApplyingFix(false)
    }
  }

  const downloadFixedDataset = async () => {
    const fixedDatasetId = fixResult?.fixed_dataset?.id
    if (!fixedDatasetId) {
      setError('Fixed dataset is unavailable for download.')
      return
    }

    setIsDownloadingFixedDataset(true)
    setError('')
    try {
      const response = await apiFetch(`/bias/fixed-datasets/${fixedDatasetId}/download`)
      if (!response.ok) {
        let message = 'Failed to download fixed dataset'
        try {
          const payload = await response.json()
          message = payload?.message || message
        } catch {
          // Response may be non-JSON on certain proxies/errors.
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const downloadName = fixResult?.fixed_dataset?.name || 'fixed-dataset.csv'
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = downloadName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
      setSuccessMessage('Fixed dataset downloaded.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsDownloadingFixedDataset(false)
    }
  }

  const comparisonChartData = fixResult
    ? [
        { name: 'Before', score: Number(fixResult.before?.bias_score || 0) },
        { name: 'After', score: Number(fixResult.after?.bias_score || 0) }
      ]
    : []

  const groupComparisonData = useMemo(() => {
    if (!fixResult) return []
    const beforeDp = fixResult.details?.before_metrics?.demographic_parity || {}
    const afterDp = fixResult.details?.after_metrics?.demographic_parity || {}
    const firstAttr = Object.keys(beforeDp)[0]
    if (!firstAttr) return []
    const beforeRates = beforeDp[firstAttr]?.group_rates || {}
    const afterRates = afterDp[firstAttr]?.group_rates || {}
    const groups = [...new Set([...Object.keys(beforeRates), ...Object.keys(afterRates)])]
    return groups.map((group) => ({
      group,
      before: Number((beforeRates[group]?.rate || 0).toFixed(4)),
      after: Number((afterRates[group]?.rate || 0).toFixed(4))
    }))
  }, [fixResult])

  const mostImpactedGroupText = useMemo(() => {
    if (!selectedSensitiveAttr || !demographicData.length) {
      return 'Most impacted group: N/A'
    }
    const sorted = [...demographicData].sort((a, b) => a.rate - b.rate)
    const lowest = sorted[0]
    const highest = sorted[sorted.length - 1]
    const deltaPct = Math.round((lowest.rate - highest.rate) * 100)
    const label = String(lowest.group).replace(/_/g, ' ')
    return `Most impacted group: ${label.charAt(0).toUpperCase() + label.slice(1)} applicants (${deltaPct}%)`
  }, [demographicData, selectedSensitiveAttr])

  const fixEffectiveness = useMemo(() => {
    const improvement = Number(fixResult?.improvement?.percentage_change || 0)
    if (improvement >= 12) return 'HIGH'
    if (improvement >= 4) return 'MODERATE'
    return 'LOW'
  }, [fixResult])

  return (
    <section className="space-y-8">
      <div className={pageCardClass}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">Dataset Flow</p>
        <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">Dataset Bias Analyzer</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Upload a dataset and compute fairness metrics against selected sensitive attributes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {workflowSteps.map((step, idx) => (
            <span
              key={step}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                idx === 0
                  ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/30'
                  : 'bg-gray-200/70 text-gray-600 ring-1 ring-gray-300/80 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
              }`}
            >
              {idx + 1}. {step}
            </span>
          ))}
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Dataset file (CSV or JSON)</span>
            <input
              type="file"
              accept=".csv,.json"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Target column</span>
            <input
              value={targetColumn}
              onChange={(event) => setTargetColumn(event.target.value)}
              placeholder="e.g. approved"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Sensitive attributes</span>
            <input
              value={sensitiveAttributes}
              onChange={(event) => setSensitiveAttributes(event.target.value)}
              placeholder="e.g. gender,age_group"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Positive outcome (optional)</span>
            <input
              value={positiveOutcome}
              onChange={(event) => setPositiveOutcome(event.target.value)}
              placeholder="e.g. yes"
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`${primaryButtonClass} w-full justify-center md:w-fit`}
          >
            {isSubmitting ? 'Analyzing...' : 'Upload and Analyze'}
          </button>
        </form>

        {(error || successMessage) && (
          <div className="mt-4 space-y-3">
            {error && <InlineAlert tone="error" title="Action failed">{error}</InlineAlert>}
            {successMessage && <InlineAlert tone="success">{successMessage}</InlineAlert>}
          </div>
        )}
      </div>

      {isSubmitting && !result && (
        <article className={subCardClass}>
          <div className="h-28 animate-pulse rounded-xl bg-gray-200/70 dark:bg-gray-800/70" />
        </article>
      )}

      {!result && (
        <EmptyStateCard
          icon="📁"
          title="Upload a dataset to begin bias analysis"
          description="Add your CSV or JSON file, choose target and sensitive attributes, then run analysis."
          hint="Tip: include columns like gender or age_group for clearer fairness insights."
          action={
            <Link
              to="/reports"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              View Previous Reports
            </Link>
          }
        />
      )}

      {result && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <article className={statCardClass}>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Rows</h3>
              <p className="mt-2 text-2xl font-semibold">{result.dataset_summary?.rows ?? 0}</p>
            </article>
            <article className={statCardClass}>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Columns</h3>
              <p className="mt-2 text-2xl font-semibold">{result.dataset_summary?.columns ?? 0}</p>
            </article>
            <article className={statCardClass}>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Bias Score</h3>
              <p className="mt-2 text-2xl font-semibold">{(result.bias_score ?? 0).toFixed(4)}</p>
              <RiskBadge level={result.risk_level} className="mt-2" />
            </article>
          </div>

          <article className={subCardClass}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{mostImpactedGroupText}</h3>
          </article>

          <div className="grid gap-6 md:grid-cols-2">
            <article className={subCardClass}>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Group Positive Rate Comparison</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
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
                    <Tooltip formatter={(value) => [Number(value || 0).toFixed(4), 'Positive rate']} />
                    <Bar dataKey="rate" name="Positive rate" fill="#4f46e5" isAnimationActive animationDuration={450} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className={subCardClass}>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Outcome Distribution by Group</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Positive vs negative outcomes per group</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="positive" stackId="a" name="Positive" fill="#16a34a" isAnimationActive animationDuration={450} />
                    <Bar dataKey="negative" stackId="a" name="Negative" fill="#dc2626" isAnimationActive animationDuration={450} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <article className={subCardClass}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Feature Correlation Heatmap</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Absolute association strength between dataset features and sensitive attributes.
              {featureCorrelationHeatmap.source === 'numeric_correlation_matrix'
                ? ' Showing numeric fallback matrix because no high-risk proxy pairs were flagged.'
                : ''}
            </p>

            {featureCorrelationHeatmap.features.length && featureCorrelationHeatmap.sensitive.length ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
                  {heatmapBucket.map((label, index) => {
                    const alpha = 0.18 + index * 0.22
                    return (
                      <span key={label} className="inline-flex items-center gap-1">
                        <span
                          className="inline-block h-3 w-6 rounded border"
                          style={{
                            backgroundColor: `rgba(99, 102, 241, ${alpha})`,
                            borderColor: `rgba(99, 102, 241, ${Math.min(0.85, alpha + 0.2)})`
                          }}
                        />
                        {label}
                      </span>
                    )
                  })}
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-2 text-left text-sm text-gray-700 dark:text-gray-200">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Feature
                        </th>
                        {featureCorrelationHeatmap.sensitive.map((sensitiveAttr) => (
                          <th
                            key={`heat-head-${sensitiveAttr}`}
                            className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                          >
                            {sensitiveAttr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {featureCorrelationHeatmap.features.map((feature) => (
                        <tr key={`heat-row-${feature}`}>
                          <td className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">{feature}</td>
                          {featureCorrelationHeatmap.sensitive.map((sensitiveAttr) => {
                            const value =
                              featureCorrelationHeatmap.values[`${feature}::${sensitiveAttr}`]
                            const cell = heatCell(value)
                            return (
                              <td key={`heat-cell-${feature}-${sensitiveAttr}`} className="align-middle">
                                <div className={cell.className} style={cell.style}>
                                  {cell.text}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                No correlation matrix could be generated for the selected dataset and attributes.
              </p>
            )}
          </article>

          <article className={subCardClass}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Flagged Proxy Features</h3>
            {result.flagged_features?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-gray-700 dark:text-gray-200">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="px-2 py-2 font-medium">Feature</th>
                      <th className="px-2 py-2 font-medium">Sensitive Attribute</th>
                      <th className="px-2 py-2 font-medium">Correlation</th>
                      <th className="px-2 py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.flagged_features.map((item) => (
                      <tr key={`${item.feature}-${item.sensitive_attribute}`} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-2 py-2">{item.feature}</td>
                        <td className="px-2 py-2">{item.sensitive_attribute}</td>
                        <td className="px-2 py-2">{item.correlation}</td>
                        <td className="px-2 py-2">
                          <RiskBadge level={item.risk} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">No highly correlated proxy features were flagged.</p>
            )}
          </article>

          <article className={subCardClass}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Apply Fix</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Apply deterministic mitigation and compare before vs after bias score.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-200">Fix type</span>
                <select
                  value={fixType}
                  onChange={(event) => setFixType(event.target.value)}
                  className={inputClass}
                >
                  <option value="REWEIGHT">REWEIGHT</option>
                  <option value="REMOVE_FEATURE">REMOVE_FEATURE</option>
                  <option value="BALANCE">BALANCE</option>
                </select>
              </label>

              {fixType === 'REMOVE_FEATURE' && (
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-200">Feature</span>
                  <input
                    value={fixFeature}
                    onChange={(event) => setFixFeature(event.target.value)}
                    placeholder="zipcode"
                    className={inputClass}
                  />
                </label>
              )}

              {fixType === 'BALANCE' && (
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-200">Method</span>
                  <select
                    value={fixMethod}
                    onChange={(event) => setFixMethod(event.target.value)}
                    className={inputClass}
                  >
                    <option value="oversample">oversample</option>
                    <option value="undersample">undersample</option>
                  </select>
                </label>
              )}
            </div>

            <button
              type="button"
              onClick={applyFix}
              disabled={isApplyingFix}
              className={`mt-4 ${primaryButtonClass}`}
            >
              {isApplyingFix ? 'Applying Fix...' : 'Apply Fix'}
            </button>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={autoApplyFix}
                disabled={isAutoApplyingFix}
                className={secondaryButtonClass}
              >
                {isAutoApplyingFix ? 'Running Auto-Fix...' : 'Auto Fix (Best Strategy)'}
              </button>
            </div>

            {fixResult && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Before: <span className="font-semibold">{fixResult.before?.bias_score}</span> ({fixResult.before?.risk_level})
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    After: <span className="font-semibold">{fixResult.after?.bias_score}</span> ({fixResult.after?.risk_level})
                  </p>
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      Number(fixResult.improvement?.delta || 0) > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : Number(fixResult.improvement?.delta || 0) < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    Improvement: {Number(fixResult.improvement?.percentage_change || 0).toFixed(2)}%
                  </p>
                  <div className="mt-2">
                    <RiskBadge level={fixEffectiveness} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{fixResult.applied_fix?.description}</p>
                  {fixResult.auto_fix?.selected && (
                    <div className="mt-3 rounded-md border border-indigo-200/60 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-200">
                      Auto-fix selected <span className="font-semibold">{fixResult.auto_fix.selected.fix_type}</span>
                      {fixResult.auto_fix.selected.rationale ? ` — ${fixResult.auto_fix.selected.rationale}` : ''}
                    </div>
                  )}
                  {fixResult.fixed_dataset?.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={downloadFixedDataset}
                        disabled={isDownloadingFixedDataset}
                        className={secondaryButtonClass}
                      >
                        {isDownloadingFixedDataset ? 'Downloading...' : 'Download Fixed Dataset'}
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fixResult.fixed_dataset?.row_count || 0} rows ready in CSV format
                      </p>
                    </div>
                  )}
                  {fixResult.warning && (
                    <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {String(fixResult.warning).toLowerCase().includes('no measurable improvement')
                        ? 'No statistically significant improvement'
                        : fixResult.warning}
                    </p>
                  )}
                </div>

                <div className="h-64 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 1]} />
                      <Tooltip formatter={(value) => [Number(value || 0).toFixed(4), 'Bias score']} />
                      <Bar dataKey="score" fill="#4f46e5" isAnimationActive animationDuration={450} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-64 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="group" />
                      <YAxis domain={[0, 1]} />
                      <Tooltip formatter={(value) => [Number(value || 0).toFixed(4), 'Rate']} />
                      <Bar dataKey="before" fill="#dc2626" name="Before rate" isAnimationActive animationDuration={450} />
                      <Bar dataKey="after" fill="#16a34a" name="After rate" isAnimationActive animationDuration={450} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
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

export default DatasetsPage
