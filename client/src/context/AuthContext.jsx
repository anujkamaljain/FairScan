import { useCallback, useMemo, useState } from 'react'
import { googleLogout } from '@react-oauth/google'
import { AuthContext } from './AuthContextObject'
import { API_BASE_URL } from '../lib/api'

const AUTH_STORAGE_KEY = 'fairsight-auth'

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

  const oauthLogin = useCallback(async ({ idToken }) => {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.message || 'Google login failed')
    }
    persist(payload.data?.token, payload.data?.user)
    return payload.data
  }, [])

  const logout = useCallback(() => {
    if (user?.authProvider === 'google') {
      googleLogout()
    }
    persist(null, null)
  }, [user?.authProvider])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      signup,
      oauthLogin,
      logout
    }),
    [token, user, login, signup, oauthLogin, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
