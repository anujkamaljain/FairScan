import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import AppShell from '../layouts/AppShell'
import LandingPage from '../pages/LandingPage'
import DashboardPage from '../pages/DashboardPage'
import DatasetsPage from '../pages/DatasetsPage'
import ReportsPage from '../pages/ReportsPage'
import ModelEvaluatorPage from '../pages/ModelEvaluatorPage'
import RealtimeAuditPage from '../pages/RealtimeAuditPage'
import LoginPage from '../pages/LoginPage'
import SignupPage from '../pages/SignupPage'
import NotFoundPage from '../pages/NotFoundPage'

export const appRouter = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/datasets', element: <DatasetsPage /> },
      { path: '/model-evaluator', element: <ModelEvaluatorPage /> },
      { path: '/realtime-audit', element: <RealtimeAuditPage /> },
      { path: '/reports', element: <ReportsPage /> }
    ]
  },
  { path: '*', element: <NotFoundPage /> }
])
