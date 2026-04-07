import { createBrowserRouter } from 'react-router-dom'
import AppShell from '../layouts/AppShell'
import DashboardPage from '../pages/DashboardPage'
import DatasetsPage from '../pages/DatasetsPage'
import ReportsPage from '../pages/ReportsPage'
import NotFoundPage from '../pages/NotFoundPage'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'datasets', element: <DatasetsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
])
