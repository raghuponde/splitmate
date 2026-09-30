import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { getMyProfile, updateProfileName } from '../data/storage'

const AuthContext = createContext(null)

// Maps a Supabase auth user to the { id, name, email, avatarUrl, createdAt } shape the app uses.
// avatarUrl lives on the profile row, so it is filled in separately (see loadAvatar).
function toAppUser(authUser) {
  if (!authUser) return null
  return {
    id: authUser.id,
    email: authUser.email,
    name: authUser.user_metadata?.name || authUser.email.split('@')[0],
    avatarUrl: null,
    createdAt: authUser.created_at,
  }
}

// Carries which password-form field an error belongs to: 'current' | 'new' | 'form'.
export class PasswordError extends Error {
  constructor(field, message) {
    super(message)
    this.field = field
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restores a persisted session on load, then keeps state in sync with
    // sign-in, sign-out, token refresh, and changes made in other tabs.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = toAppUser(session?.user)
      if (!next) {
        setUser(null)
        setLoading(false)
        return
      }
      // Keep the current avatar while it is re-fetched so the navbar does not flicker.
      setUser((prev) => ({ ...next, avatarUrl: prev?.id === next.id ? prev.avatarUrl : null }))
      // Deferred: supabase-js must not be called synchronously inside this callback.
      setTimeout(async () => {
        try {
          const profile = await getMyProfile()
          setUser((prev) => (prev?.id === next.id ? { ...prev, avatarUrl: profile?.avatarUrl ?? null } : prev))
        } catch {
          // Leave the default avatar in place if the profile can't be read.
        }
        setLoading(false)
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Re-reads the auth user and profile after a mutation. Throws if either read fails.
  async function refreshUser() {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw new Error(error.message)
    const next = toAppUser(data.user)
    const profile = await getMyProfile()
    setUser({ ...next, avatarUrl: profile?.avatarUrl ?? null })
  }

  // Updates the name in both profiles and auth metadata; reverts the profile if the second step fails.
  async function updateName(name) {
    const previous = user.name
    try {
      await updateProfileName(name)
    } catch {
      throw new Error("Couldn't save your name. Please try again.")
    }
    const { error } = await supabase.auth.updateUser({ data: { name } })
    if (error) {
      try {
        await updateProfileName(previous)
      } catch {
        // Best effort revert.
      }
      throw new Error("Couldn't save your name. Please try again.")
    }
  }

  // Verifies the current password by signing in again, then sets the new one.
  async function changePassword(current, next) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    })
    if (verifyError) {
      if (verifyError.status === 400) throw new PasswordError('current', 'Current password is incorrect.')
      if (verifyError.status === 429) throw new PasswordError('form', 'Too many attempts. Wait a minute and try again.')
      throw new PasswordError('form', "Couldn't update your password. Please try again.")
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) {
      if (error.status === 429) throw new PasswordError('form', 'Too many attempts. Wait a minute and try again.')
      if (error.code === 'weak_password' || error.status === 422) {
        throw new PasswordError('new', error.message || 'That password is too weak. Try a longer one.')
      }
      throw new PasswordError('form', "Couldn't update your password. Please try again.")
    }
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(error.status === 400 ? 'Invalid email or password' : error.message)
    }
    return toAppUser(data.user)
  }

  async function register(name, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) throw new Error(error.message)
    // Email confirmation enabled: the account exists but there is no session yet.
    if (!data.session) throw new Error('Check your email to confirm your account, then sign in.')
    return toAppUser(data.user)
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, updateName, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
