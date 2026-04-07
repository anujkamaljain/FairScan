import { Link } from 'react-router-dom'
import ThemeToggle from '../components/theme/ThemeToggle'

const featureCards = [
  {
    title: 'Bias Detection',
    description: 'Detect disparity across sensitive attributes with metrics your team can trust.'
  },
  {
    title: 'Real-Time Monitoring',
    description: 'Audit live predictions and identify confidence shifts before they become incidents.'
  },
  {
    title: 'Explainability (Gemini)',
    description: 'Translate technical fairness output into concise, stakeholder-ready explanations.'
  },
  {
    title: 'Mitigation & Simulation',
    description: 'Apply fixes, compare before-vs-after impact, and validate decisions with confidence.'
  }
]

const workflowSteps = ['Upload Dataset', 'Analyze Bias', 'Apply Mitigation', 'Monitor in Real-Time']

function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-linear-to-b from-indigo-300/35 via-indigo-200/15 to-transparent dark:from-indigo-500/10 dark:via-indigo-500/5" />

      <section className="relative px-4 pb-16 pt-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border border-gray-200 bg-white/85 px-4 py-3 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-white/3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-300">
              FS
            </div>
            <span className="text-sm font-semibold tracking-wide text-gray-900 dark:text-white">FairScan</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors duration-200 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-600"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      <section className="relative px-4 pb-20 pt-8 sm:px-6 md:pt-12">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="animate-in fade-in duration-500">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Fairness Intelligence Platform</p>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-gray-900 dark:text-white md:text-6xl">
              Build Fair AI Systems with Confidence
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-gray-700 dark:text-gray-300 md:text-lg">
              FairScan detects, explains, and fixes bias in real-time AI decisions with a workflow designed for engineering, compliance, and leadership teams.
            </p>
            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                to="/signup"
                className="inline-flex w-full justify-center rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-600 sm:w-auto"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full justify-center rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition-all duration-200 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-600 dark:hover:bg-gray-800 sm:w-auto"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl shadow-gray-200/70 backdrop-blur dark:border-white/10 dark:bg-white/3 dark:shadow-black/40">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-950/80">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Live Fairness Snapshot</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/80">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Bias Score</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">0.3184</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/80">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Risk Level</p>
                  <p className="mt-1 text-xl font-semibold text-amber-300">MEDIUM</p>
                </div>
                <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-900/80">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Most Impacted Group</p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">Female applicants (-18%)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">Designed for responsible AI teams</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/3 dark:hover:border-white/20 dark:hover:bg-white/5"
              >
                <div className="h-1.5 w-8 rounded-full bg-indigo-400/60" />
                <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 md:p-10 dark:border-white/10 dark:bg-white/3">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white md:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {workflowSteps.map((step, idx) => (
              <div
                key={step}
                className="rounded-xl border border-gray-200 bg-gray-50 p-5 transition-all duration-200 hover:border-gray-300 dark:border-white/10 dark:bg-gray-950/70 dark:hover:border-white/20"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">Step {idx + 1}</p>
                <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-8 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8 text-center md:p-10 dark:border-white/10 dark:bg-white/3">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white md:text-4xl">Start building fair AI today</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-700 dark:text-gray-300 md:text-base">
            Move from manual fairness checks to a unified, production-ready fairness workflow.
          </p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="inline-flex rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-600"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
