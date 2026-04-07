import { useCallback, useMemo, useState } from 'react'
import { AuthContext } from './AuthContextObject'
import { API_BASE_URL } from '../lib/api'

const AUTH_STORAGE_KEY = 'fairsight-auth'
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || 'demo@fairscan.ai'
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'demo123456'
const DEMO_NAME = import.meta.env.VITE_DEMO_NAME || 'FairScan Demo'

const getInitialAuthState = () => {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) {
    return { token: null, user: null }
  }

  try {
    const parsed = JSON.parse(stored)
    return {
      token: parsed?.token || null,
      user: parsed?.user || null
    }
  } catch {
    return { token: null, user: null }
  }
}

export function AuthProvider({ children }) {
  const initialState = useMemo(() => getInitialAuthState(), [])
  const [token, setToken] = useState(initialState.token)
  const [user, setUser] = useState(initialState.user)

  const persist = (nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    if (nextToken && nextUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }

  const login = useCallback(async ({ email, password }) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.message || 'Invalid credentials')
    }
    persist(payload.data?.token, payload.data?.user)
    return payload.data
  }, [])

  const signup = useCallback(async ({ name, email, password }) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.message || 'Signup failed')
    }
    persist(payload.data?.token, payload.data?.user)
    return payload.data
  }, [])

  const logout = useCallback(() => {
    persist(null, null)
  }, [])

  const continueAsDemoUser = useCallback(async () => {
    try {
      return await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    } catch {
      try {
        return await signup({ name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD })
      } catch (signupError) {
        throw new Error(signupError?.message || 'Demo user is currently unavailable')
      }
    }
  }, [login, signup])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      signup,
      continueAsDemoUser,
      logout
    }),
    [token, user, login, signup, continueAsDemoUser, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
