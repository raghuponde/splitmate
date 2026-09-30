import useDocumentTitle from '../utils/useDocumentTitle'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Mail, Pencil, PlusCircle, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as storage from '../data/storage'
import Navbar from '../components/Navbar'
import AddExpenseModal from '../components/AddExpenseModal'
import { formatCurrency } from '../utils/format'
import { SPLIT_EPSILON, calculateNetBalances, simplifyDebts } from '../utils/balance'
import { BADGE_ACTIVE, BADGE_PENDING, BUTTON_PRIMARY, CARD } from '../utils/styles'

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name, you = false, size = 'h-8 w-8' }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
        you ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-600'
      }`}
    >
      {initials(name)}
    </span>
  )
}

const ACTION_BUTTON =
  'flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary'

function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  // Bumping this re-runs the data load below after a mutation.
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState({ group: null, members: [], expenses: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useDocumentTitle(data.group?.name)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const group = await storage.getGroupById(id)
        if (!group) {
          if (!cancelled) setData({ group: null, members: [], expenses: [] })
          return
        }
        const [members, expenses] = await Promise.all([
          storage.getGroupMembers(group.id),
          storage.getExpensesForGroup(group.id),
        ])
        if (!cancelled) setData({ group, members, expenses })
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
  }, [id, refreshKey])

  const { group, members, expenses } = data
  const settlements = simplifyDebts(calculateNetBalances(expenses))

  if (loading || error || !group) {
    return (
      <div className="min-h-screen bg-bg">
        <Navbar />
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className={`text-sm ${error ? 'text-negative-text' : 'text-text-muted'}`}>
            {error ? `Couldn't load this group: ${error}` : loading ? 'Loading...' : 'Group not found.'}
          </p>
        </div>
      </div>
    )
  }

  const userById = (uid) => members.find((m) => m.id === uid) || null

  async function handleDeleteExpense(expenseId) {
    try {
      await storage.deleteExpense(expenseId)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditingExpense(null)
  }

  function handleExpenseSaved() {
    handleCloseModal()
    setRefreshKey((k) => k + 1)
  }

  const mySettlements = settlements.filter((s) => s.from === user.id || s.to === user.id)
  const otherSettlements = settlements.filter((s) => s.from !== user.id && s.to !== user.id)
  const pendingEmails = group.pendingEmails || []
  const memberCount = members.length + pendingEmails.length

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-text-primary">{group.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {expenses.length}{' '}
              {expenses.length === 1 ? 'expense' : 'expenses'}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-2 whitespace-nowrap ${BUTTON_PRIMARY}`}
          >
            <PlusCircle size={16} />
            Add expense
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="expenses-heading">
            <h2 id="expenses-heading" className="mb-3 text-base font-semibold text-text-primary">
              Expenses
            </h2>
            {expenses.length === 0 ? (
              <p className={`${CARD} py-12 text-center text-sm text-text-muted`}>
                No expenses yet. Add the first one to start tracking.
              </p>
            ) : (
              <ul className="space-y-3">
                {expenses.map((expense) => {
                  const payer = userById(expense.paidBy)
                  const paidByYou = expense.paidBy === user.id
                  const myShare = expense.splits.find((sp) => sp.userId === user.id)?.amount ?? 0
                  const lent = paidByYou ? expense.amount - myShare : 0
                  const owed = paidByYou ? 0 : myShare
                  return (
                    <li key={expense.id} className={`${CARD} !p-4 sm:!p-5`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold leading-snug text-text-primary">
                            {expense.description}
                          </h3>
                          <p className="mt-1 text-sm text-text-secondary">
                            {paidByYou ? 'You' : payer?.name || 'Unknown'} paid · {expense.date}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular-nums text-xl font-bold text-text-primary">
                            {formatCurrency(expense.amount)}
                          </p>
                          {lent > SPLIT_EPSILON && (
                            <p className="tabular-nums mt-0.5 text-xs font-semibold text-positive-text">
                              you lent {formatCurrency(lent)}
                            </p>
                          )}
                          {owed > SPLIT_EPSILON && (
                            <p className="tabular-nums mt-0.5 text-xs font-semibold text-negative-text">
                              you owe {formatCurrency(owed)}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-text-muted">
                        Split:{' '}
                        {expense.splits
                          .map(
                            (split) =>
                              `${split.userId === user.id ? 'You' : userById(split.userId)?.name || 'Unknown'} ${formatCurrency(split.amount)}`
                          )
                          .join(' · ')}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                        <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                          {expense.category}
                        </span>
                        <div className="flex items-center gap-1">
                          {expense.createdBy === user.id && (
                            <button
                              onClick={() => setEditingExpense(expense)}
                              className={`${ACTION_BUTTON} hover:bg-bg hover:text-primary`}
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className={`${ACTION_BUTTON} hover:bg-negative-bg hover:text-danger`}
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <aside className="space-y-8">
            <section aria-labelledby="balances-heading">
              <h2 id="balances-heading" className="mb-3 text-base font-semibold text-text-primary">
                Balances
              </h2>
              {settlements.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl bg-positive-bg px-4 py-4 text-positive-text">
                  <CheckCircle2 size={20} className="shrink-0" />
                  <p className="text-sm font-semibold">Everyone is settled up.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mySettlements.length > 0 && (
                    <ul className="space-y-2">
                      {mySettlements.map((s, i) => {
                        const youOwe = s.from === user.id
                        const other = userById(youOwe ? s.to : s.from)
                        return (
                          <li
                            key={`mine-${i}`}
                            className={`flex items-center gap-3 rounded-xl px-4 py-3.5 ${
                              youOwe ? 'bg-negative-bg text-negative-text' : 'bg-positive-bg text-positive-text'
                            }`}
                          >
                            <Avatar name={other?.name || '?'} size="h-9 w-9" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium">{youOwe ? 'You owe' : 'Owes you'}</p>
                              <p className="truncate text-sm font-semibold">{other?.name || 'Unknown'}</p>
                            </div>
                            <span className="tabular-nums text-xl font-extrabold">
                              {formatCurrency(s.amount)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {otherSettlements.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-text-secondary">Between others</p>
                      <ul className={`${CARD} divide-y divide-border !p-0`}>
                        {otherSettlements.map((s, i) => (
                          <li key={`other-${i}`} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                            <span className="min-w-0 truncate text-text-primary">{userById(s.from)?.name}</span>
                            <ArrowRight size={14} className="shrink-0 text-text-muted" aria-label="owes" />
                            <span className="min-w-0 flex-1 truncate text-text-primary">
                              {userById(s.to)?.name}
                            </span>
                            <span className="tabular-nums font-semibold text-text-secondary">
                              {formatCurrency(s.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section aria-labelledby="members-heading">
              <h2 id="members-heading" className="mb-3 text-base font-semibold text-text-primary">
                Members <span className="font-normal text-text-muted">{memberCount}</span>
              </h2>
              <ul className={`${CARD} divide-y divide-border !p-0`}>
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={m.name} you={m.id === user.id} />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {m.name}
                      {m.id === user.id && <span className="text-text-secondary"> (you)</span>}
                    </span>
                    <span className={BADGE_ACTIVE}>active</span>
                  </li>
                ))}
                {pendingEmails.map((email) => (
                  <li key={email} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-badge-pending-text/40 text-badge-pending-text">
                      <Mail size={14} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary" title={email}>
                      {email}
                    </span>
                    <span className={BADGE_PENDING}>pending</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>

      {(showModal || editingExpense) && (
        <AddExpenseModal
          group={group}
          members={members}
          currentUserId={user.id}
          expense={editingExpense}
          onClose={handleCloseModal}
          onSaved={handleExpenseSaved}
        />
      )}
    </div>
  )
}

export default GroupDetail
