function SectionCard({ title, description, actions, className = '', children }) {
  return (
    <article
      className={`card-scroll rounded-2xl border border-gray-200/80 bg-white/90 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/90 ${className}`}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
            {description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </article>
  )
}

export default SectionCard
