import { Link } from 'react-router-dom'

function AuthSplitLayout({ title, subtitle, switchText, switchLinkText, switchTo, children }) {
  return (
    <section className="min-h-screen bg-gray-950 text-gray-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden border-r border-white/10 lg:flex">
          <div className="absolute inset-0 bg-linear-to-b from-indigo-600/30 via-indigo-700/10 to-black" />
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="absolute right-10 top-44 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="relative flex h-full w-full flex-col justify-between p-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">FairScan</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight text-white">AI Fairness Platform</h1>
              <p className="mt-4 max-w-md text-base leading-7 text-gray-200">
                Build trustworthy AI by detecting, explaining, and fixing bias before it reaches production.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-gray-200 backdrop-blur">
              Trusted workflow for fairness auditing across datasets, models, and live inference.
            </div>
          </div>
        </aside>

        <div className="flex items-center justify-center px-4 py-10 sm:px-6">
          <article className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl shadow-black/40 transition-all duration-200">
            <div className="lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">FairScan</p>
              <p className="mt-2 text-sm text-gray-400">AI Fairness Platform</p>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm text-gray-300">{subtitle}</p>

            <div className="mt-6 space-y-4">{children}</div>

            <p className="mt-6 text-center text-sm text-gray-300">
              {switchText}{' '}
              <Link to={switchTo} className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300">
                {switchLinkText}
              </Link>
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

export default AuthSplitLayout
