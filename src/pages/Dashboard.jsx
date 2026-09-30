import useDocumentTitle from '../utils/useDocumentTitle'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as storage from '../data/storage'
import Navbar from '../components/Navbar'
import { formatCurrency } from '../utils/format'
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, balancePillClasses } from '../utils/styles'

function useUserGroupBalances(userId) {
  const [groupBalances, setGroupBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const groups = await storage.getGroupsForUser()
        const balances = await Promise.all(
          groups.map(async (group) => {
            const settlements = await storage.simplifyDebts(group.id)
            let net = 0
            for (const s of settlements) {
              if (s.from === userId) net -= s.amount
              if (s.to === userId) net += s.amount
            }
            return { group, net }
          })
        )
        if (!cancelled) setGroupBalances(balances)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return { groupBalances, loading, error }
}

function BalanceLabel({ net }) {
  const EPS = 0.005
  if (net > EPS) {
    return <span className={balancePillClasses(net)}>You&apos;re owed {formatCurrency(net)}</span>
  }
  if (net < -EPS) {
    return <span className={balancePillClasses(net)}>You owe {formatCurrency(net)}</span>
  }
  return <span className={balancePillClasses(net)}>All settled</span>
}

function Dashboard() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const { groupBalances, loading, error } = useUserGroupBalances(user.id)

  const totals = useMemo(() => {
    let owedToYou = 0
    let youOwe = 0
    for (const { net } of groupBalances) {
      if (net > 0) owedToYou += net
      else youOwe += -net
    }
    return { owedToYou, youOwe, net: owedToYou - youOwe }
  }, [groupBalances])

  const netColor =
    totals.net > 0.005 ? 'text-positive-text' : totals.net < -0.005 ? 'text-negative-text' : 'text-neutral-text'

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={CARD}>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Owed to you</p>
            <p className="tabular-nums mt-2 text-2xl font-extrabold text-positive-text">
              {formatCurrency(totals.owedToYou)}
            </p>
          </div>
          <div className={CARD}>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">You owe</p>
            <p className="tabular-nums mt-2 text-2xl font-extrabold text-negative-text">
              {formatCurrency(totals.youOwe)}
            </p>
          </div>
          <div className={CARD}>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Net balance</p>
            <p className={`tabular-nums mt-2 text-2xl font-extrabold ${netColor}`}>
              {totals.net >= 0 ? '' : '-'}
              {formatCurrency(totals.net)}
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">Your groups</h1>
          <div className="flex items-center gap-2">
            <Link to="/reports" className={`flex items-center gap-2 ${BUTTON_SECONDARY}`}>
              <BarChart3 size={16} />
              View reports
            </Link>
            <Link to="/group/new" className={`flex items-center gap-2 ${BUTTON_PRIMARY}`}>
              <Plus size={16} />
              Create group
            </Link>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-negative-text">Couldn&apos;t load your groups: {error}</p>
        ) : loading ? (
          <p className="text-sm text-text-muted">Loading your groups...</p>
        ) : groupBalances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="mb-4 text-sm text-text-muted">You&apos;re not in any groups yet.</p>
            <Link to="/group/new" className={`inline-flex items-center gap-2 ${BUTTON_PRIMARY}`}>
              <Plus size={16} />
              Create group
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {groupBalances.map(({ group, net }) => (
              <Link
                key={group.id}
                to={`/group/${group.id}`}
                className={`block ${CARD} transition-colors hover:border-primary/40`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{group.name}</h2>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {group.memberIds.length} member{group.memberIds.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <BalanceLabel net={net} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
