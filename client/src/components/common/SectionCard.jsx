function SectionCard({ title, description }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </article>
  )
}

export default SectionCard
