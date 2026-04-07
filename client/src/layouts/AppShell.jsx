import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import PrimaryNav from '../components/navigation/PrimaryNav'
import ThemeToggle from '../components/theme/ThemeToggle'
import { useAuth } from '../context/useAuth'

function HamburgerIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </>
      )}
    </svg>
  )
}

function AppShell() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileOpen])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const initial = (user?.name || 'U').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-gray-950 dark:text-gray-100">
      <header
        ref={menuRef}
        className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg dark:border-gray-800/80 dark:bg-gray-900/80"
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <img src="/Logo.png" alt="FairScan logo" className="h-8 w-8 rounded-lg object-contain" />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
                FairScan
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                AI Fairness Platform
              </p>
            </div>
          </div>

          {/* Desktop nav — centred */}
          <PrimaryNav />

          {/* Desktop right section */}
          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-3 dark:border-gray-700 dark:bg-gray-800/60">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {initial}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {user?.name || 'User'}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              Logout
            </button>
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <ThemeToggle />
          </div>

          {/* Mobile right section */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              aria-label="Toggle menu"
            >
              <HamburgerIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <div
          className={`overflow-hidden border-t border-gray-200/80 transition-all duration-200 ease-in-out dark:border-gray-800/80 lg:hidden ${
            mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 border-t-0 opacity-0'
          }`}
        >
          <div className="mx-auto max-w-7xl space-y-3 px-4 pb-4 pt-3 sm:px-6">
            <PrimaryNav mobile onNavigate={closeMobile} />

            <div className="h-px bg-gray-200 dark:bg-gray-700" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {initial}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.email || user?.role || 'user'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeMobile()
                  logout()
                }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
