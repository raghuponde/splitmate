import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-40 h-14 border-b border-border bg-surface">
      <div className="mx-auto flex h-full max-w-[680px] items-center justify-between px-4">
        <Link to={user ? '/dashboard' : '/'} className="text-base font-bold text-text-primary">
          Splitmate
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">{user.name}</span>
            <button
              onClick={handleLogout}
              className="cursor-pointer text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
