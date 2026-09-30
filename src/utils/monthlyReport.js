// Pure aggregation helpers for the Reports page — no database access.
// Amounts are summed in integer cents so totals never drift by floating-point error.
// Dates are plain 'YYYY-MM-DD' strings and months are 'YYYY-MM'; neither is ever
// converted through Date/time zones, so an expense never lands in the wrong month.

import { SPLIT_EPSILON } from './balance'
import { CATEGORIES, DEFAULT_CATEGORY } from './categories'

export const METRIC_SHARE = 'share'
export const METRIC_TOTAL = 'total'

export const RANGE_PRESETS = [
  { value: 'last3', label: 'Last 3 months', months: 3 },
  { value: 'last6', label: 'Last 6 months', months: 6 },
  { value: 'last12', label: 'Last 12 months', months: 12 },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
]
export const DEFAULT_PRESET = 'last6'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function toCents(amount) {
  return Math.round(Number(amount) * 100)
}

// Anything outside CATEGORIES (or missing) is reported as "Other".
export function normalizeCategory(category) {
  return CATEGORIES.includes(category) ? category : DEFAULT_CATEGORY
}

// --- Dates ---

// Today's local date as 'YYYY-MM-DD'.
export function todayISO(now = new Date()) {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

// Inclusive list of 'YYYY-MM' from `fromMonth` to `toMonth`.
export function monthsBetween(fromMonth, toMonth) {
  const months = []
  for (let m = fromMonth; m <= toMonth; m = addMonths(m, 1)) months.push(m)
  return months
}

// 'Jan 26' (or 'Jan' when `withYear` is false).
export function monthLabel(month, withYear = true) {
  const [y, m] = month.split('-')
  const name = MONTH_NAMES[Number(m) - 1]
  return withYear ? `${name} ${y.slice(2)}` : name
}

// 'Sep 29, 2026' from 'YYYY-MM-DD'.
export function formatDate(date) {
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${MONTH_NAMES[Number(m) - 1]} ${Number(d)}, ${y}`
}

// { from, to } ('YYYY-MM-DD', inclusive) for a preset; { from: null, to: null } means
// unbounded ("All time"). "Last N months" is the current month plus the previous N-1,
// starting on the first day of the earliest month and ending today.
export function resolvePresetRange(preset, today = todayISO()) {
  if (preset === 'all') return { from: null, to: null }
  if (preset === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today }
  const n = RANGE_PRESETS.find((p) => p.value === preset)?.months ?? 6
  return { from: `${addMonths(today.slice(0, 7), -(n - 1))}-01`, to: today }
}

// The months the chart spans. Bounded ranges use their own bounds; "All time" runs from the
// earliest matching expense through the current month (or the latest expense, if it is later).
export function monthRangeFor({ from, to }, expenses, today = todayISO()) {
  if (from && to) return { fromMonth: from.slice(0, 7), toMonth: to.slice(0, 7) }
  const current = today.slice(0, 7)
  if (expenses.length === 0) return { fromMonth: current, toMonth: current }
  let earliest = expenses[0].date.slice(0, 7)
  let latest = earliest
  for (const e of expenses) {
    const m = e.date.slice(0, 7)
    if (m < earliest) earliest = m
    if (m > latest) latest = m
  }
  return { fromMonth: earliest, toMonth: latest > current ? latest : current }
}

// --- Amounts ---

// Cents of an expense the user takes part in through a split.
function shareCents(expense, userId) {
  let cents = 0
  for (const s of expense.splits) if (s.userId === userId) cents += toCents(s.amount)
  return cents
}

// True when the user paid for the expense or has a split on it.
export function involvesUser(expense, userId) {
  return expense.paidBy === userId || expense.splits.some((s) => s.userId === userId)
}

// Dollar amount an expense contributes to a report for the given metric.
export function expenseAmountFor(expense, userId, metric) {
  return centsFor(expense, userId, metric) / 100
}

function centsFor(expense, userId, metric) {
  return metric === METRIC_TOTAL ? toCents(expense.amount) : shareCents(expense, userId)
}

// --- Filtering and aggregation ---

// Applies the report filters. `from`/`to` are inclusive 'YYYY-MM-DD' (null = unbounded),
// `groupId`/`category` are null for "all". In "My share" mode, expenses the user neither
// paid for nor split are dropped. Input order (date desc) is preserved.
export function filterExpenses(expenses, { from, to, groupId, category, userId, metric }) {
  return expenses.filter((e) => {
    const date = e.date.slice(0, 10)
    if (from && date < from) return false
    if (to && date > to) return false
    if (groupId && e.groupId !== groupId) return false
    if (category && normalizeCategory(e.category) !== category) return false
    if (metric === METRIC_SHARE && !involvesUser(e, userId)) return false
    return true
  })
}

// [{ month: 'YYYY-MM', total, byCategory: { [category]: amount } }] with a bucket for every
// month between fromMonth and toMonth, including months with no spend.
export function groupByMonth(expenses, userId, metric, { fromMonth, toMonth }) {
  const buckets = new Map(
    monthsBetween(fromMonth, toMonth).map((month) => [month, { totalCents: 0, byCategory: {} }])
  )
  for (const e of expenses) {
    const bucket = buckets.get(e.date.slice(0, 7))
    if (!bucket) continue
    const cents = centsFor(e, userId, metric)
    const category = normalizeCategory(e.category)
    bucket.totalCents += cents
    bucket.byCategory[category] = (bucket.byCategory[category] || 0) + cents
  }
  return [...buckets].map(([month, { totalCents, byCategory }]) => ({
    month,
    total: totalCents / 100,
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([c, cents]) => [c, cents / 100])),
  }))
}

// { total, monthlyAverage, topCategory: { category, amount } | null }.
// The average divides by every month in the range (empty months count as zero) and rounds
// to the nearest cent. Ties for top category go to whichever comes first in CATEGORIES.
export function summarize(monthly) {
  const categoryCents = {}
  let totalCents = 0
  for (const { total, byCategory } of monthly) {
    totalCents += toCents(total)
    for (const [category, amount] of Object.entries(byCategory)) {
      categoryCents[category] = (categoryCents[category] || 0) + toCents(amount)
    }
  }

  let top = null
  for (const category of CATEGORIES) {
    const cents = categoryCents[category] || 0
    if (cents > 0 && (top === null || cents > top.cents)) top = { category, cents }
  }

  return {
    total: totalCents / 100,
    monthlyAverage: monthly.length ? Math.round(totalCents / monthly.length) / 100 : 0,
    topCategory: top && top.cents / 100 >= SPLIT_EPSILON ? { category: top.category, amount: top.cents / 100 } : null,
  }
}

// Sums for the table footer: { total, share } in dollars.
export function sumExpenses(expenses, userId) {
  let total = 0
  let share = 0
  for (const e of expenses) {
    total += toCents(e.amount)
    share += shareCents(e, userId)
  }
  return { total: total / 100, share: share / 100 }
}
