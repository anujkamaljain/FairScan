import { Link } from 'react-router-dom'

function AuthSplitLayout({ title, subtitle, switchText, switchLinkText, switchTo, children }) {
  return (
    <section className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden border-r border-gray-200 lg:flex dark:border-white/10">
          <div className="absolute inset-0 bg-linear-to-b from-indigo-200/80 via-indigo-100/50 to-white dark:from-indigo-600/30 dark:via-indigo-700/10 dark:to-black" />
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-indigo-400/40 blur-3xl dark:bg-indigo-500/30" />
          <div className="absolute right-10 top-44 h-64 w-64 rounded-full bg-cyan-300/35 blur-3xl dark:bg-cyan-500/20" />
          <div className="relative flex h-full w-full flex-col justify-between p-12">
            <div>
              <div className="flex items-center gap-2.5">
                <img src="/Logo.png" alt="FairScan logo" className="h-9 w-9 rounded-lg object-contain" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">FairScan</p>
              </div>
              <h1 className="mt-4 text-4xl font-bold leading-tight text-gray-900 dark:text-white">AI Fairness Platform</h1>
              <p className="mt-4 max-w-md text-base leading-7 text-gray-700 dark:text-gray-200">
                Build trustworthy AI by detecting, explaining, and fixing bias before it reaches production.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-300/80 bg-white/65 p-5 backdrop-blur dark:border-white/15 dark:bg-white/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Platform Snapshot
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/70">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Bias Score</p>
                  <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">0.3184</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/70">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Risk</p>
                  <p className="mt-1 text-base font-semibold text-amber-500 dark:text-amber-300">MEDIUM</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/70">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Coverage</p>
                  <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">99.2%</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/70">
                <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Last 7-day trend</p>
                <div className="mt-3 flex items-end gap-1.5">
                  {[30, 42, 38, 50, 46, 58, 54].map((height, idx) => (
                    <div
                      key={`trend-${idx}`}
                      className="w-6 rounded-sm bg-indigo-300/70 transition-all duration-200 dark:bg-indigo-500/70"
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-300/70 bg-white/50 p-5 text-sm text-gray-700 backdrop-blur dark:border-white/15 dark:bg-white/5 dark:text-gray-200">
              Trusted workflow for fairness auditing across datasets, models, and live inference.
            </div>
          </div>
        </aside>

        <div className="flex items-center justify-center px-4 py-10 sm:px-6">
          <article className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl shadow-gray-200/70 transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/40">
            <div className="lg:hidden">
              <div className="flex items-center gap-2">
                <img src="/Logo.png" alt="FairScan logo" className="h-8 w-8 rounded-md object-contain" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">FairScan</p>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">AI Fairness Platform</p>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>

            <div className="mt-6 space-y-4">{children}</div>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
              {switchText}{' '}
              <Link to={switchTo} className="font-semibold text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
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
