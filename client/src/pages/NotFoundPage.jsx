import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Page not found</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        The route you requested does not exist in this environment.
      </p>
      <Link
        to="/dashboard"
        className="mt-4 inline-flex rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
      >
        Return to dashboard
      </Link>
    </section>
  )
}

export default NotFoundPage
