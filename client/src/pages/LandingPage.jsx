import { Link } from 'react-router-dom'

const featureCards = [
  {
    title: 'Bias Detection',
    description: 'Detect fairness issues across sensitive groups with rigorous statistical checks.',
    icon: '⚖️'
  },
  {
    title: 'Real-Time Monitoring',
    description: 'Monitor live decisions and identify drift, confidence shifts, and risk spikes instantly.',
    icon: '📡'
  },
  {
    title: 'Explainability (Gemini)',
    description: 'Generate executive-ready explanations that make fairness outcomes understandable.',
    icon: '✨'
  },
  {
    title: 'Auto Fix & Simulation',
    description: 'Apply mitigation strategies and compare before-vs-after impact before rollout.',
    icon: '🛠️'
  }
]

const workflowSteps = [
  'Upload Dataset',
  'Analyze Bias',
  'Fix Issues',
  'Monitor in Real-Time'
]

function LandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-950 via-black to-black text-gray-100">
      <section className="relative overflow-hidden px-4 pb-20 pt-24 sm:px-6 md:pt-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute -left-20 top-40 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center animate-in fade-in duration-700">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">FairScan</p>
            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-6xl">
              Build Fair AI Systems with Confidence
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-gray-300 md:text-lg">
              FairScan detects, explains, and fixes bias in real-time AI decisions.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex w-full justify-center rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-600 active:scale-[0.99] sm:w-auto"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full justify-center rounded-xl border border-gray-700 bg-gray-900/70 px-6 py-3 text-sm font-semibold text-gray-100 transition-all duration-200 hover:scale-[1.02] hover:border-gray-600 hover:bg-gray-800 active:scale-[0.99] sm:w-auto"
              >
                View Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold text-white md:text-3xl">Designed for responsible AI teams</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-indigo-400/40"
              >
                <div className="text-2xl" aria-hidden="true">
                  {card.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-300">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30 backdrop-blur md:p-10">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {workflowSteps.map((step, idx) => (
              <div
                key={step}
                className="rounded-2xl border border-white/10 bg-gray-950/60 p-5 transition-all duration-200 hover:scale-[1.02] hover:border-indigo-400/40"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Step {idx + 1}</p>
                <p className="mt-3 text-base font-medium text-gray-100">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 pt-8 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-indigo-400/30 bg-linear-to-r from-indigo-500/20 via-indigo-500/10 to-cyan-500/20 p-8 text-center shadow-xl shadow-indigo-950/40 md:p-10">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Start building fair AI today</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-200 md:text-base">
            Move from manual fairness checks to a complete, production-ready bias intelligence platform.
          </p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="inline-flex rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-600 active:scale-[0.99]"
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
