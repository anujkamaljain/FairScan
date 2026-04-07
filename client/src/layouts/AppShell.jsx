import { Outlet } from 'react-router-dom'
import PrimaryNav from '../components/navigation/PrimaryNav'
import ThemeToggle from '../components/theme/ThemeToggle'

function AppShell() {
  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-slate-50 transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              FairSight AI
            </p>
            <h1 className="text-xl font-semibold">AI Fairness Platform</h1>
          </div>
          <div className="flex items-center gap-3">
            <PrimaryNav />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
