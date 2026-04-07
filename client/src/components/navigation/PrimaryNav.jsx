import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/datasets', label: 'Datasets' },
  { to: '/model-evaluator', label: 'Model Evaluator' },
  { to: '/realtime-audit', label: 'Realtime Audit' },
  { to: '/reports', label: 'Bias Reports' }
]

function PrimaryNav() {
  return (
    <nav className="flex gap-2">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-indigo-500 text-white dark:bg-indigo-600'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default PrimaryNav
