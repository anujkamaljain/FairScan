import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ActivityItem from '../components/common/ActivityItem'
import EmptyStateCard from '../components/common/EmptyStateCard'
import InlineAlert from '../components/common/InlineAlert'
import MetricCard from '../components/common/MetricCard'
import RiskBadge from '../components/common/RiskBadge'
import SectionCard from '../components/common/SectionCard'
import apiFetch from '../lib/api'

const BiasTrendChart = lazy(() => import('../components/dashboard/BiasTrendChart'))
const RiskDistributionChart = lazy(() => import('../components/dashboard/RiskDistributionChart'))

function ChartSkeleton() {
  return <div className="h-72 animate-pulse rounded-xl bg-gray-200/70 dark:bg-gray-800/70" />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-36 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-gray-800/70" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="h-96 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-gray-800/70" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="h-72 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-gray-800/70" />
        ))}
      </div>
    </div>
  )
}

function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await apiFetch('/dashboard/summary')
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to load dashboard summary')
        }
        setSummary(payload?.data || null)
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [])

  const trendData = useMemo(() => {
    const rows = [
      ...(summary?.dataset_risk_summary || []).map((item) => ({
        label: new Date(item.timestamp).toLocaleDateString(),
        score: Number(item.bias_score || 0)
      })),
      ...(summary?.model_risk_summary || []).map((item) => ({
        label: new Date(item.timestamp).toLocaleDateString(),
        score: Number(item.bias_score || 0)
      }))
    ]
    return rows.slice(0, 8).reverse()
  }, [summary])

  const riskDistributionData = useMemo(() => {
    const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 }
    ;[...(summary?.dataset_risk_summary || []), ...(summary?.model_risk_summary || [])].forEach((item) => {
      const level = String(item.risk_level || 'LOW').toUpperCase()
      if (level in riskCounts) {
        riskCounts[level] += 1
      }
    })
    return Object.entries(riskCounts).map(([label, count]) => ({ label, count }))
  }, [summary])

  const hasAnyData =
    (summary?.model_risk_summary || []).length > 0 ||
    (summary?.dataset_risk_summary || []).length > 0 ||
    (summary?.realtime_alerts || []).length > 0 ||
    (summary?.recent_activity || []).length > 0

  const formatMostImpactedGroup = (value) => {
    if (!value) return 'Most impacted group: N/A'
    if (value.toLowerCase().includes('most impacted group')) return value
    return `Most impacted group: ${value}`
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">Overview</p>
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Executive Dashboard</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Unified fairness intelligence across datasets, model evaluations, and realtime decisions.
        </p>
      </header>

      {error && (
        <InlineAlert tone="error" title="Failed to load dashboard">
          {error}
        </InlineAlert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <MetricCard
          label="Overall Bias Score"
          value={Number(summary?.overall_bias_score || 0).toFixed(4)}
          subtext="Composite across latest model and dataset analyses"
        />
        <SectionCard title="Risk Level" description="Current platform posture">
          <div className="mt-5">
            <RiskBadge level={summary?.overall_risk_level || 'LOW'} />
          </div>
        </SectionCard>
        <MetricCard
          label="Most Affected Group"
          value={formatMostImpactedGroup(summary?.most_affected_group || 'N/A')}
          subtext="Largest disparity observed in latest dataset report"
          accent="rose"
        />
      </div>

      {!hasAnyData && (
        <EmptyStateCard
          icon="📊"
          title="No fairness data yet"
          description="Run your first dataset or model analysis to populate this dashboard."
          hint="Start with the Dataset Analyzer for the fastest path to insights."
          action={
            <Link
              to="/datasets"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-600 active:scale-[0.99]"
            >
              Go to Dataset Analyzer
            </Link>
          }
        />
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Bias Trend"
          description="Rolling trend of model and dataset bias scores"
        >
          <div className="mt-6">
            <Suspense fallback={<ChartSkeleton />}>
              <BiasTrendChart data={trendData} />
            </Suspense>
          </div>
        </SectionCard>

        <SectionCard title="Risk Distribution" description="Current LOW / MEDIUM / HIGH split">
          <div className="mt-6">
            <Suspense fallback={<ChartSkeleton />}>
              <RiskDistributionChart data={riskDistributionData} />
            </Suspense>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Model Risk Summary" description="Latest evaluated model runs">
          <div className="mt-6 space-y-3">
            {(summary?.model_risk_summary || []).length ? (
              summary.model_risk_summary.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-md dark:border-gray-800 dark:bg-gray-950/60"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.model}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Score: {Number(item.bias_score || 0).toFixed(4)}
                    </p>
                  </div>
                  <RiskBadge level={item.risk_level} />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No model risk entries yet.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Dataset Risk Summary" description="Latest uploaded and analyzed datasets">
          <div className="mt-6 space-y-3">
            {(summary?.dataset_risk_summary || []).length ? (
              summary.dataset_risk_summary.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-md dark:border-gray-800 dark:bg-gray-950/60"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.dataset}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Score: {Number(item.bias_score || 0).toFixed(4)}
                    </p>
                  </div>
                  <RiskBadge level={item.risk_level} />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No dataset risk entries yet.</p>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Mitigation Impact" description="Last applied bias mitigation fix">
        <div className="mt-6">
          {summary?.last_applied_fix ? (
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                label="Fix Type"
                value={summary.last_applied_fix.fix_type}
                subtext={summary.last_applied_fix.description}
                accent="emerald"
              />
              <MetricCard
                label="Before vs After"
                value={`${Number(summary.last_applied_fix.before_score || 0).toFixed(3)} -> ${Number(summary.last_applied_fix.after_score || 0).toFixed(3)}`}
                subtext="Composite bias score shift"
              />
              <MetricCard
                label="Improvement"
                value={`${Number(summary.last_applied_fix.improvement_percentage || 0).toFixed(2)}%`}
                subtext="Relative change from baseline"
              />
              <SectionCard title="Effectiveness">
                <div className="mt-4">
                  <RiskBadge level={summary.last_applied_fix.effectiveness || 'LOW'} />
                </div>
              </SectionCard>
              {summary.last_applied_fix.no_significant_improvement && (
                <p className="md:col-span-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  No statistically significant improvement
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No fix has been applied yet.</p>
          )}
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Recent Activity" description="Latest fairness and governance operations">
          <div className="mt-6 space-y-3">
            {(summary?.recent_activity || []).length ? (
              summary.recent_activity.map((item) => (
                <ActivityItem key={item.id} timestamp={item.timestamp} message={item.message} />
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Realtime Alerts" description="Counterfactual and confidence-shift triggers">
          <div className="mt-6 space-y-3">
            {(summary?.realtime_alerts || []).length ? (
              summary.realtime_alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-gray-200/70 bg-gray-50 px-4 py-3 transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/60"
                >
                  <div className="flex items-center justify-between">
                    <RiskBadge level={alert.risk_level} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(alert.timestamp).toLocaleString()}</p>
                  </div>
                  <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{alert.message}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Reason: {alert.reason_code}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No realtime alerts</p>
            )}
          </div>
        </SectionCard>
      </div>
    </section>
  )
}

export default DashboardPage
