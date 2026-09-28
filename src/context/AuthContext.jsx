import { createContext, useContext, useEffect, useState } from 'react'
import * as storage from '../data/storage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    storage.seedTestAccountsIfNeeded()
    setUser(storage.getCurrentUser())
    setLoading(false)
  }, [])

  function login(email, password) {
    const existing = storage.getUserByEmail(email)
    if (!existing || existing.password !== password) {
      throw new Error('Invalid email or password')
    }
    storage.setCurrentUser(existing.id)
    setUser(existing)
    return existing
  }

  function register(name, email, password) {
    const created = storage.createUser({ name, email, password })
    storage.setCurrentUser(created.id)
    setUser(created)
    return created
  }

  function logout() {
    storage.clearCurrentUser()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
