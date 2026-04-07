import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import { useAuth } from '../context/useAuth'

function LoginPage() {
  const navigate = useNavigate()
  const { login, continueAsDemoUser, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login({ email, password })
      navigate('/dashboard')
    } catch (submitError) {
      setError(submitError.message || 'Invalid credentials')
    } finally {
      setIsLoading(false)
    }
  }

  const onDemoContinue = async () => {
    setError('')
    setIsDemoLoading(true)
    try {
      await continueAsDemoUser()
      navigate('/dashboard')
    } catch (demoError) {
      setError(demoError.message || 'Demo login failed')
    } finally {
      setIsDemoLoading(false)
    }
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AuthSplitLayout
      title="Welcome back"
      subtitle="Sign in to continue your fairness workflows."
      switchText="Don't have an account?"
      switchLinkText="Sign up"
      switchTo="/signup"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="mb-2 block text-gray-200">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-gray-100 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-2 block text-gray-200">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-gray-100 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </label>

        {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={isLoading || isDemoLoading}
          className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Signing in...' : 'Login'}
        </button>

        <button
          type="button"
          onClick={onDemoContinue}
          disabled={isLoading || isDemoLoading}
          className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm font-medium text-gray-100 transition-all duration-200 hover:scale-[1.02] hover:bg-gray-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDemoLoading ? 'Preparing demo...' : 'Continue as Demo User'}
        </button>
      </form>
    </AuthSplitLayout>
  )
}

export default LoginPage
