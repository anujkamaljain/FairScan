function EmptyStateCard({ icon = '○', title, description, hint, action }) {
  return (
    <article className="card-scroll rounded-2xl border border-dashed border-gray-300/80 bg-white/70 p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900/70">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/15 text-xl text-indigo-400">
        <span aria-hidden="true">{icon}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>
      {hint && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </article>
  )
}

export default EmptyStateCard
