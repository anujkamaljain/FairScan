import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="mt-2 text-sm text-slate-600">
        The route you requested does not exist in this environment.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Return to dashboard
      </Link>
    </section>
  )
}

export default NotFoundPage
