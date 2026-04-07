import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/datasets', label: 'Datasets' },
  { to: '/model-evaluator', label: 'Model Evaluator' },
  { to: '/realtime-audit', label: 'Realtime Audit' },
  { to: '/reports', label: 'Reports' }
]

const desktopLinkClass = ({ isActive }) =>
  `relative px-3 py-2 text-sm font-medium transition-colors duration-150 ${
    isActive
      ? 'text-indigo-600 dark:text-indigo-400'
      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
  }`

const mobileLinkClass = ({ isActive }) =>
  `block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
    isActive
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400'
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60'
  }`

function PrimaryNav({ mobile = false, onNavigate }) {
  return (
    <nav className={mobile ? 'flex flex-col gap-1' : 'hidden lg:flex lg:items-center lg:gap-1'}>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={mobile ? mobileLinkClass : desktopLinkClass}
        >
          {({ isActive }) => (
            <>
              {item.label}
              {!mobile && isActive && (
                <span className="absolute inset-x-1 -bottom-[13px] h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default PrimaryNav
