import { useState } from 'react'
import * as storage from '../data/storage'
import { computeEqualSplits, SPLIT_EPSILON } from '../utils/balance'
import { formatCurrency } from '../utils/format'
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT } from '../utils/styles'

const SPLIT_TYPE_BUTTON = 'flex-1 cursor-pointer rounded-md py-1.5 text-sm font-medium transition-colors'
const SPLIT_TYPE_BUTTON_ACTIVE = 'bg-surface text-text-primary shadow-sm'
const SPLIT_TYPE_BUTTON_INACTIVE = 'text-text-muted hover:text-text-primary'

function AddExpenseModal({ group, members, currentUserId, onClose, onSaved }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [shares, setShares] = useState(() => new Set(members.map((m) => m.id)))
  const [splitType, setSplitType] = useState('equal')
  const [manualAmounts, setManualAmounts] = useState({})
  const [error, setError] = useState('')

  const numericAmount = parseFloat(amount) || 0
  const shareCount = shares.size
  const perPersonShare = shareCount > 0 ? numericAmount / shareCount : 0

  const manualTotal = Array.from(shares).reduce(
    (sum, userId) => sum + (parseFloat(manualAmounts[userId]) || 0),
    0
  )
  const manualDiff = numericAmount - manualTotal

  function toggleShare(userId) {
    setShares((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function handleSplitTypeChange(nextType) {
    if (nextType === splitType) return
    if (nextType === 'manual') {
      // Prefill manual amounts from the current equal split so the user is
      // tweaking a balanced starting point instead of an empty form.
      const equalSplits = computeEqualSplits(numericAmount, Array.from(shares))
      const prefill = {}
      for (const split of equalSplits) {
        prefill[split.userId] = split.amount ? String(split.amount) : ''
      }
      setManualAmounts(prefill)
    } else {
      // Don't try to remember manual amounts across a re-toggle — recompute fresh.
      setManualAmounts({})
    }
    setSplitType(nextType)
    setError('')
  }

  function handleManualAmountChange(userId, value) {
    setManualAmounts((prev) => ({ ...prev, [userId]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!description.trim()) {
      setError('Please enter what this expense was for.')
      return
    }
    if (numericAmount <= 0) {
      setError('Please enter an amount greater than zero.')
      return
    }
    if (shares.size === 0) {
      setError('Select at least one person to split this with.')
      return
    }

    let splits

    if (splitType === 'manual') {
      const zeroMember = members.find(
        (m) => shares.has(m.id) && (parseFloat(manualAmounts[m.id]) || 0) <= 0
      )
      if (zeroMember) {
        setError(`Enter an amount for ${zeroMember.name}, or uncheck them.`)
        return
      }
      if (Math.abs(manualDiff) > SPLIT_EPSILON) {
        setError(
          manualDiff > 0
            ? `Amounts are short by ${formatCurrency(manualDiff)}.`
            : `Amounts are over by ${formatCurrency(-manualDiff)}.`
        )
        return
      }
      splits = Array.from(shares).map((userId) => ({
        userId,
        amount: parseFloat(manualAmounts[userId]) || 0,
      }))
    } else {
      splits = computeEqualSplits(numericAmount, Array.from(shares))
    }

    storage.createExpense({
      groupId: group.id,
      description: description.trim(),
      amount: numericAmount,
      paidBy,
      splits,
      splitType,
      date,
    })

    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-surface p-6 shadow-none">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-semibold text-text-primary">Add expense</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-xl leading-none text-text-muted transition-colors hover:text-text-primary"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">What was it for?</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT}
              placeholder="Dinner, cab, groceries..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Total amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={INPUT}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Who paid?</label>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={INPUT}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-text-primary">Who shares it?</label>
              <div className="flex rounded-lg bg-bg p-0.5">
                <button
                  type="button"
                  onClick={() => handleSplitTypeChange('equal')}
                  className={`${SPLIT_TYPE_BUTTON} ${
                    splitType === 'equal' ? SPLIT_TYPE_BUTTON_ACTIVE : SPLIT_TYPE_BUTTON_INACTIVE
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => handleSplitTypeChange('manual')}
                  className={`${SPLIT_TYPE_BUTTON} ${
                    splitType === 'manual' ? SPLIT_TYPE_BUTTON_ACTIVE : SPLIT_TYPE_BUTTON_INACTIVE
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>
            <div className="space-y-1 rounded-lg border border-border p-2">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-bg"
                >
                  <span className="flex items-center gap-2 text-text-primary">
                    <input
                      type="checkbox"
                      checked={shares.has(m.id)}
                      onChange={() => toggleShare(m.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    {m.name}
                  </span>
                  {shares.has(m.id) &&
                    (splitType === 'manual' ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualAmounts[m.id] ?? ''}
                        onChange={(e) => handleManualAmountChange(m.id, e.target.value)}
                        onClick={(e) => e.preventDefault()}
                        className="w-24 rounded-md border border-border bg-surface px-2 py-1 text-right text-xs tabular-nums text-text-primary outline-none focus:border-primary"
                        placeholder="0.00"
                      />
                    ) : (
                      numericAmount > 0 && (
                        <span className="tabular-nums text-xs text-text-muted">
                          {formatCurrency(perPersonShare)}
                        </span>
                      )
                    ))}
                </label>
              ))}
            </div>
            {splitType === 'manual' && numericAmount > 0 && (
              <p
                className={`mt-1.5 text-xs tabular-nums ${
                  Math.abs(manualDiff) > SPLIT_EPSILON ? 'text-negative-text' : 'text-text-muted'
                }`}
              >
                Assigned {formatCurrency(manualTotal)} of {formatCurrency(numericAmount)}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-negative-text">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
              Cancel
            </button>
            <button type="submit" className={BUTTON_PRIMARY}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddExpenseModal
