import { Outlet } from 'react-router-dom'
import PrimaryNav from '../components/navigation/PrimaryNav'

function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              FairSight AI
            </p>
            <h1 className="text-xl font-semibold">AI Fairness Platform</h1>
          </div>
          <PrimaryNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
