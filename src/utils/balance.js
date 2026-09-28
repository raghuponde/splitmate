// Pure balance/split math — no localStorage access. See ../data/storage.js for persistence.

export const SPLIT_EPSILON = 0.005

// Divides `amount` evenly among memberIds, distributing any leftover cent(s)
// from integer-cent rounding to the first members so the splits always sum
// exactly to `amount`.
export function computeEqualSplits(amount, memberIds) {
  const count = memberIds.length
  if (count === 0) return []

  const totalCents = Math.round(amount * 100)
  const baseCents = Math.floor(totalCents / count)
  const remainderCents = totalCents - baseCents * count

  return memberIds.map((userId, i) => ({
    userId,
    amount: (baseCents + (i < remainderCents ? 1 : 0)) / 100,
  }))
}

// Returns { [userId]: netAmount } across the given expenses.
// Positive netAmount means that user is owed money overall.
// Negative netAmount means that user owes money overall.
export function calculateNetBalances(expenses) {
  const balances = {}
  for (const expense of expenses) {
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount
    for (const split of expense.splits) {
      balances[split.userId] = (balances[split.userId] || 0) - split.amount
    }
  }
  return balances
}

// Simplifies a net-balances map into the minimum number of payments.
// Returns an array of { from: userId, to: userId, amount } meaning
// `from` owes `to` `amount`.
export function simplifyDebts(balances) {
  const debtors = [] // owe money, negative balance
  const creditors = [] // owed money, positive balance

  for (const [userId, amount] of Object.entries(balances)) {
    if (amount < -SPLIT_EPSILON) debtors.push({ userId, amount: -amount })
    else if (amount > SPLIT_EPSILON) creditors.push({ userId, amount })
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const settlements = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.amount, creditor.amount)

    if (amount > SPLIT_EPSILON) {
      settlements.push({ from: debtor.userId, to: creditor.userId, amount })
    }

    debtor.amount -= amount
    creditor.amount -= amount

    if (debtor.amount <= SPLIT_EPSILON) i++
    if (creditor.amount <= SPLIT_EPSILON) j++
  }

  return settlements
}
