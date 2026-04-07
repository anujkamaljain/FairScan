import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyStateCard from '../components/common/EmptyStateCard'
import InlineAlert from '../components/common/InlineAlert'
import RiskBadge from '../components/common/RiskBadge'
import SectionCard from '../components/common/SectionCard'
import apiFetch from '../lib/api'

function buildReportsFromSummary(summary) {
  const reports = []
  ;(summary.dataset_risk_summary || []).forEach((item, idx) => {
    reports.push({
      id: item.id || `ds-${idx}`,
      title: item.dataset || `Dataset #${idx + 1}`,
      type: 'Dataset',
      risk: item.risk_level || 'LOW',
      summary: `Bias score: ${Number(item.bias_score || 0).toFixed(4)}`,
      mitigation: item.fix_applied ? 'Mitigation applied' : 'No mitigation applied yet'
    })
  })
  ;(summary.model_risk_summary || []).forEach((item, idx) => {
    reports.push({
      id: item.id || `mdl-${idx}`,
      title: item.model || `Model #${idx + 1}`,
      type: 'Model',
      risk: item.risk_level || 'LOW',
      summary: `Bias score: ${Number(item.bias_score || 0).toFixed(4)}`,
      mitigation: item.fix_applied ? 'Mitigation applied' : 'No mitigation applied yet'
    })
  })
  return reports
}

function ReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true)
      try {
        const response = await apiFetch('/dashboard/summary')
        const payload = await response.json()
        if (response.ok && payload?.data) {
          const built = buildReportsFromSummary(payload.data)
          setReports(built)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [])

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">Reporting</p>
        <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Bias Reports</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Executive-ready report summaries across dataset, model, and mitigation workflows.
        </p>
      </header>

      {error && <InlineAlert tone="error" title="Failed to load reports">{error}</InlineAlert>}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-gray-800/70" />
          ))}
        </div>
      ) : !reports.length ? (
        <EmptyStateCard
          icon="📝"
          title="No reports generated yet"
          description="Complete a dataset or model analysis to generate your first fairness report."
          hint="Reports consolidate risk, impacted groups, and mitigation outcomes for stakeholders."
          action={
            <Link
              to="/datasets"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-600 active:scale-[0.99]"
            >
              Run Analysis
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {reports.map((report) => (
            <SectionCard key={report.id} title={report.title} description={`Report type: ${report.type}`}>
              <div className="mt-4 space-y-2">
                <RiskBadge level={report.risk} />
                <p className="text-sm text-gray-700 dark:text-gray-300">{report.summary}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{report.mitigation}</p>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </section>
  )
}

export default ReportsPage
