import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as storage from '../data/storage'
import Navbar from '../components/Navbar'
import { formatCurrency } from '../utils/format'
import { BUTTON_PRIMARY, CARD, balancePillClasses } from '../utils/styles'

function useUserGroupBalances(userId) {
  return useMemo(() => {
    const groups = storage.getGroupsForUser(userId)
    return groups.map((group) => {
      const settlements = storage.simplifyDebts(group.id)
      let net = 0
      for (const s of settlements) {
        if (s.from === userId) net -= s.amount
        if (s.to === userId) net += s.amount
      }
      return { group, net }
    })
  }, [userId])
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
  const { user } = useAuth()
  const groupBalances = useUserGroupBalances(user.id)

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
      <div className="mx-auto max-w-[680px] px-4 py-8">
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
          <Link to="/group/new" className={BUTTON_PRIMARY}>
            Create group
          </Link>
        </div>

        {groupBalances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="mb-4 text-sm text-text-muted">You&apos;re not in any groups yet.</p>
            <Link to="/group/new" className={`inline-block ${BUTTON_PRIMARY}`}>
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
