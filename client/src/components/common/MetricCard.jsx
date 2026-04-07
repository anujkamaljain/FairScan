import { memo } from 'react'

const MetricCard = memo(function MetricCard({ label, value, subtext, accent = 'indigo' }) {
  const gradient =
    accent === 'emerald'
      ? 'from-emerald-500/10 via-emerald-500/5 to-transparent'
      : accent === 'rose'
        ? 'from-rose-500/10 via-rose-500/5 to-transparent'
        : 'from-indigo-500/10 via-indigo-500/5 to-transparent'

  return (
    <article
      className={`card-scroll rounded-2xl border border-gray-200/80 bg-linear-to-br ${gradient} bg-white p-6 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-lg dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 dark:bg-gray-900`}
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
      {subtext && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{subtext}</p>}
    </article>
  )
})

export default MetricCard
