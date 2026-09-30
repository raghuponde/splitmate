import useDocumentTitle from '../utils/useDocumentTitle'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { BUTTON_PRIMARY, INPUT } from '../utils/styles'
import Logo from '../components/Logo'

function Login() {
  useDocumentTitle('Sign In')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Logo size={120} className="mx-auto mb-6" />
      <h1 className="mb-1 text-xl font-bold text-text-primary">Sign in</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Test accounts: shubham@test.com / bob@test.com / rahul@test.com / eva@test.com, password
        for all: <span className="font-medium text-text-primary">password</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
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

        <button type="submit" className={`flex w-full items-center justify-center gap-2 ${BUTTON_PRIMARY}`}>
          <LogIn size={16} />
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        No account?{' '}
        <Link to="/register" className="font-medium text-primary hover:text-primary-hover">
          Register
        </Link>
      </p>
    </div>
  )
}

export default Login
