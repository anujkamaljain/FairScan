import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import { useAuth } from '../context/useAuth'

function LoginPage() {
  const navigate = useNavigate()
  const { login, oauthLogin, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const isGoogleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'

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

  const onGoogleSuccess = async (credentialResponse) => {
    const idToken = credentialResponse?.credential
    if (!idToken) {
      setError('Google authentication failed: missing ID token')
      return
    }
    setError('')
    setIsGoogleLoading(true)
    try {
      await oauthLogin({ idToken })
      navigate('/dashboard')
    } catch (oauthError) {
      setError(oauthError.message || 'Google login failed')
    } finally {
      setIsGoogleLoading(false)
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
          <span className="mb-2 block text-gray-700 dark:text-gray-200">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-2 block text-gray-700 dark:text-gray-200">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className={inputClass}
          />
        </label>

        {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={isLoading || isGoogleLoading}
          className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:bg-indigo-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Signing in...' : 'Login'}
        </button>

        {isGoogleEnabled && (
          <>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300 dark:border-gray-700" />
              </div>
              <span className="relative flex justify-center text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span className="bg-white px-2 dark:bg-gray-900">or</span>
              </span>
            </div>
            <div className="w-full overflow-hidden rounded-lg p-0">
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={() => setError('Google sign-in failed')}
                text="signin_with"
                shape="pill"
                theme="filled_black"
                width="100%"
              />
            </div>
            {isGoogleLoading && <p className="text-center text-xs text-gray-400">Signing in with Google...</p>}
          </>
        )}
      </form>
    </AuthSplitLayout>
  )
}

export default LoginPage
