import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as storage from '../data/storage'
import Navbar from '../components/Navbar'
import AddExpenseModal from '../components/AddExpenseModal'
import { formatCurrency } from '../utils/format'
import { BADGE_ACTIVE, BADGE_PENDING, BUTTON_PRIMARY, CARD } from '../utils/styles'

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-semibold text-stone-600">
      {initials(name)}
    </span>
  )
}

function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  // Bumping this triggers a re-render, which re-reads fresh data from storage below.
  const [, setRefreshKey] = useState(0)

  const group = storage.getGroupById(id)

  const members = group
    ? group.memberIds.map((uid) => storage.getUserById(uid)).filter(Boolean)
    : []

  const expenses = group
    ? storage
        .getExpensesForGroup(group.id)
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    : []

  const settlements = group ? storage.simplifyDebts(group.id) : []

  if (!group) {
    return (
      <div className="min-h-screen bg-bg">
        <Navbar />
        <div className="mx-auto max-w-[680px] px-4 py-8">
          <p className="text-sm text-text-muted">Group not found.</p>
        </div>
      </div>
    )
  }

  const userById = (uid) => storage.getUserById(uid)

  function handleDeleteExpense(expenseId) {
    storage.deleteExpense(expenseId)
    setRefreshKey((k) => k + 1)
  }

  function handleExpenseSaved() {
    setShowModal(false)
    setRefreshKey((k) => k + 1)
  }

  const mySettlements = settlements.filter((s) => s.from === user.id || s.to === user.id)
  const otherSettlements = settlements.filter((s) => s.from !== user.id && s.to !== user.id)

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="mx-auto max-w-[680px] px-4 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{group.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {members.map((m) => (
                <span key={m.id} className="flex items-center gap-1.5">
                  <Avatar name={m.name} />
                  <span className="text-sm text-text-secondary">{m.name}</span>
                  <span className={BADGE_ACTIVE}>active</span>
                </span>
              ))}
              {(group.pendingEmails || []).map((email) => (
                <span key={email} className="flex items-center gap-1.5">
                  <span className="text-sm text-text-secondary">{email}</span>
                  <span className={BADGE_PENDING}>pending</span>
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className={`whitespace-nowrap ${BUTTON_PRIMARY}`}>
            Add expense
          </button>
        </div>

        <div className={`mb-8 ${CARD} !p-0`}>
          <h2 className="border-b border-border px-5 py-4 text-lg font-semibold text-text-primary">
            Expenses
          </h2>
          {expenses.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-text-muted">No expenses yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {expenses.map((expense) => {
                const payer = userById(expense.paidBy)
                return (
                  <li key={expense.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{expense.description}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Paid by {payer?.name || 'Unknown'} · {expense.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="tabular-nums text-base font-bold text-text-primary">
                        {formatCurrency(expense.amount)}
                      </span>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="cursor-pointer text-xs font-medium text-text-muted transition-colors hover:text-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Balances</h2>
          {settlements.length === 0 ? (
            <p className="text-sm text-text-muted">Everyone is settled up.</p>
          ) : (
            <div className="space-y-4">
              {mySettlements.length > 0 && (
                <ul className="space-y-3">
                  {mySettlements.map((s, i) => {
                    const from = userById(s.from)
                    const to = userById(s.to)
                    const youOwe = s.from === user.id
                    return (
                      <li
                        key={`mine-${i}`}
                        className={`tabular-nums text-lg font-bold ${
                          youOwe ? 'text-negative-text' : 'text-positive-text'
                        }`}
                      >
                        {youOwe ? (
                          <>
                            You owe <span className="font-extrabold">{to?.name}</span>{' '}
                            {formatCurrency(s.amount)}
                          </>
                        ) : (
                          <>
                            <span className="font-extrabold">{from?.name}</span> owes you{' '}
                            {formatCurrency(s.amount)}
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {otherSettlements.length > 0 && (
                <ul
                  className={`space-y-1.5 ${
                    mySettlements.length > 0 ? 'border-t border-border pt-4' : ''
                  }`}
                >
                  {otherSettlements.map((s, i) => {
                    const from = userById(s.from)
                    const to = userById(s.to)
                    return (
                      <li key={`other-${i}`} className="tabular-nums text-sm text-text-muted">
                        {from?.name} owes {to?.name} {formatCurrency(s.amount)}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddExpenseModal
          group={group}
          members={members}
          currentUserId={user.id}
          onClose={() => setShowModal(false)}
          onSaved={handleExpenseSaved}
        />
      )}
    </div>
  )
}

export default GroupDetail
