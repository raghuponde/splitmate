import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BUTTON_PRIMARY, INPUT } from '../utils/styles'

function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.')
      return
    }

    try {
      register(name.trim(), email.trim(), password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-xl font-bold text-text-primary">Create your account</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </div>

        {error && <p className="text-sm text-negative-text">{error}</p>}

        <button type="submit" className={`w-full ${BUTTON_PRIMARY}`}>
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default Register
