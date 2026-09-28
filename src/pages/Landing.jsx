import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BUTTON_PRIMARY } from '../utils/styles'

function Landing() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [loading, user, navigate])

  return (
    <div className="mx-auto max-w-[680px] px-4">
      <div className="flex h-14 items-center justify-between">
        <span className="text-base font-bold text-text-primary">Splitmate</span>
        <Link to="/login" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
          Sign in
        </Link>
      </div>

      <div className="py-24 text-center">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-[32px]">
          Split expenses. Skip the spreadsheet.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-text-secondary">
          Splitmate makes it easy to track shared expenses with friends, roommates, and
          travel groups — and always know who owes what.
        </p>
        <Link to="/register" className={`mt-8 inline-block ${BUTTON_PRIMARY}`}>
          Get started
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 border-t border-border py-16 sm:grid-cols-3">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Create groups</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Set up a group for any trip, household, or occasion and invite people by email.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Track shared expenses</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Log what was spent, who paid, and how it should be split — equally or otherwise.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">See who owes what</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Splitmate simplifies balances automatically so settling up takes the fewest payments possible.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Landing
