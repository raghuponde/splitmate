import useDocumentTitle from '../utils/useDocumentTitle'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as storage from '../data/storage'
import Navbar from '../components/Navbar'
import MonthlyChart from '../components/MonthlyChart'
import { CATEGORIES } from '../utils/categories'
import { formatCurrency } from '../utils/format'
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT } from '../utils/styles'
import { csvFilename, downloadCsv, expensesToCsv } from '../utils/csvExport'
import {
  DEFAULT_PRESET,
  METRIC_SHARE,
  METRIC_TOTAL,
  RANGE_PRESETS,
  filterExpenses,
  formatDate,
  groupByMonth,
  monthLabel,
  monthRangeFor,
  normalizeCategory,
  resolvePresetRange,
  summarize,
  sumExpenses,
  todayISO,
} from '../utils/monthlyReport'

const PAGE_SIZE = 25
const LABEL = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted'

function useReportData(refreshKey) {
  const [data, setData] = useState({ groups: [], expenses: [], users: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [groups, expenses, users] = await Promise.all([
          storage.getGroups(),
          storage.getExpenses(),
          storage.getUsers(),
        ])
        if (!cancelled) setData({ groups, expenses, users })
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
  }, [refreshKey])

  return { ...data, loading, error }
}

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-bg ${className}`} />
}

function Tile({ label, value, sub }) {
  return (
    <div className={CARD}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="tabular-nums mt-2 text-2xl font-extrabold text-text-primary">{value}</p>
      {sub && <p className="mt-0.5 truncate text-sm text-text-secondary">{sub}</p>}
    </div>
  )
}

function Reports() {
  useDocumentTitle('Reports')
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const { groups, expenses, users, loading, error } = useReportData(refreshKey)

  const [preset, setPreset] = useState(DEFAULT_PRESET)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [range, setRange] = useState(() => resolvePresetRange(DEFAULT_PRESET))
  const [rangeError, setRangeError] = useState('')
  const [groupId, setGroupId] = useState('')
  const [category, setCategory] = useState('')
  const [metric, setMetric] = useState(METRIC_SHARE)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [page, setPage] = useState(0)
  const [csvError, setCsvError] = useState('')

  const today = todayISO()

  // Any change to what is being reported drops the month chip and returns to page 1.
  function resetView() {
    setSelectedMonth(null)
    setPage(0)
    setCsvError('')
  }

  function changePreset(next) {
    resetView()
    setPreset(next)
    setRangeError('')
    if (next === 'custom') {
      const seed = range.from ? range : resolvePresetRange(DEFAULT_PRESET, today)
      setCustomFrom(seed.from ?? '')
      setCustomTo(seed.to ?? '')
      return
    }
    setRange(resolvePresetRange(next, today))
  }

  // An invalid custom range shows an error and keeps the previous results.
  function changeCustom(from, to) {
    resetView()
    setCustomFrom(from)
    setCustomTo(to)
    if (!from || !to) return setRangeError('Choose both dates.')
    if (from > to) return setRangeError('"From" must be on or before "To".')
    setRangeError('')
    setRange({ from, to })
  }

  function clearFilters() {
    resetView()
    setPreset(DEFAULT_PRESET)
    setRange(resolvePresetRange(DEFAULT_PRESET, today))
    setRangeError('')
    setGroupId('')
    setCategory('')
  }

  const groupsById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups])
  const names = useMemo(() => {
    const map = Object.fromEntries(users.map((u) => [u.id, u.name]))
    map[user.id] = user.name
    return map
  }, [users, user])

  // Expenses whose group the user has left are not reported.
  const scoped = useMemo(() => expenses.filter((e) => groupsById[e.groupId]), [expenses, groupsById])

  const filterArgs = { ...range, groupId: groupId || null, category: category || null, userId: user.id }
  const filtered = useMemo(
    () => filterExpenses(scoped, { ...filterArgs, metric }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, range, groupId, category, metric, user.id]
  )
  const monthly = useMemo(
    () => groupByMonth(filtered, user.id, metric, monthRangeFor(range, filtered, today)),
    [filtered, range, metric, user.id, today]
  )
  const summary = useMemo(() => summarize(monthly), [monthly])

  const tableRows = useMemo(
    () => (selectedMonth ? filtered.filter((e) => e.date.startsWith(selectedMonth)) : filtered),
    [filtered, selectedMonth]
  )
  const footer = useMemo(() => sumExpenses(tableRows, user.id), [tableRows, user.id])

  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = tableRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // In "My share" mode an empty result may only mean the user isn't part of these expenses.
  const hiddenByShare =
    metric === METRIC_SHARE &&
    filtered.length === 0 &&
    filterExpenses(scoped, { ...filterArgs, metric: METRIC_TOTAL }).length > 0

  const paidByLabel = (id) => (id === user.id ? 'You' : names[id] || 'Unknown member')

  function handleDownload() {
    setCsvError('')
    try {
      const csv = expensesToCsv(filtered, {
        userId: user.id,
        groupName: (id) => groupsById[id]?.name ?? '',
        memberName: (id) => names[id] || 'Unknown member',
      })
      downloadCsv(csv, csvFilename())
    } catch (err) {
      setCsvError(`Couldn't create the CSV: ${err.message}`)
    }
  }

  const noGroups = !loading && !error && groups.length === 0
  const noExpenses = !loading && !error && groups.length > 0 && scoped.length === 0
  const showControls = !loading && !error && !noGroups && !noExpenses
  const noResults = showControls && filtered.length === 0

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-text-primary">Reports</h1>
          {!noGroups && (
            <button
              onClick={handleDownload}
              disabled={loading || filtered.length === 0}
              className={`flex items-center gap-2 ${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Download size={16} />
              Download CSV
            </button>
          )}
        </div>
        {csvError && <p className="mb-4 text-sm text-negative-text">{csvError}</p>}

        {error && (
          <div className={CARD}>
            <p className="text-sm text-negative-text">Couldn&apos;t load your reports: {error}</p>
            <button onClick={() => setRefreshKey((k) => k + 1)} className={`mt-3 ${BUTTON_SECONDARY}`}>
              Retry
            </button>
          </div>
        )}

        {noGroups && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="mb-4 text-sm text-text-muted">No groups yet.</p>
            <Link to="/group/new" className={`inline-block ${BUTTON_PRIMARY}`}>
              Create group
            </Link>
          </div>
        )}

        {noExpenses && (
          <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center">
            <p className="mb-4 text-sm text-text-muted">
              No expenses yet — add one in a group to see reports.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {groups.map((g) => (
                <Link key={g.id} to={`/group/${g.id}`} className={BUTTON_SECONDARY}>
                  {g.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-36" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-72" />
            <Skeleton className="h-64" />
          </div>
        )}

        {showControls && (
          <div className="space-y-4">
            <div className={`${CARD} grid grid-cols-1 gap-4 sm:grid-cols-2`}>
              <div>
                <label htmlFor="report-range" className={LABEL}>
                  Date range
                </label>
                <select
                  id="report-range"
                  className={INPUT}
                  value={preset}
                  onChange={(e) => changePreset(e.target.value)}
                >
                  {RANGE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="report-group" className={LABEL}>
                  Group
                </label>
                <select
                  id="report-group"
                  className={INPUT}
                  value={groupId}
                  onChange={(e) => {
                    resetView()
                    setGroupId(e.target.value)
                  }}
                >
                  <option value="">All groups</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                  <div>
                    <label htmlFor="report-from" className={LABEL}>
                      From
                    </label>
                    <input
                      id="report-from"
                      type="date"
                      className={INPUT}
                      value={customFrom}
                      onChange={(e) => changeCustom(e.target.value, customTo)}
                    />
                  </div>
                  <div>
                    <label htmlFor="report-to" className={LABEL}>
                      To
                    </label>
                    <input
                      id="report-to"
                      type="date"
                      className={INPUT}
                      value={customTo}
                      onChange={(e) => changeCustom(customFrom, e.target.value)}
                    />
                  </div>
                  {rangeError && (
                    <p role="alert" className="col-span-2 text-sm text-negative-text">
                      {rangeError}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="report-category" className={LABEL}>
                  Category
                </label>
                <select
                  id="report-category"
                  className={INPUT}
                  value={category}
                  onChange={(e) => {
                    resetView()
                    setCategory(e.target.value)
                  }}
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={LABEL} id="report-show-label">
                  Show
                </span>
                <div
                  role="group"
                  aria-labelledby="report-show-label"
                  className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg p-1"
                >
                  {[
                    [METRIC_SHARE, 'My share'],
                    [METRIC_TOTAL, 'Group total'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={metric === value}
                      onClick={() => {
                        resetView()
                        setMetric(value)
                      }}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        metric === value
                          ? 'bg-surface text-text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Tile label="Total" value={formatCurrency(summary.total)} />
              <Tile label="Monthly average" value={formatCurrency(summary.monthlyAverage)} />
              <Tile
                label="Top category"
                value={summary.topCategory ? formatCurrency(summary.topCategory.amount) : '—'}
                sub={summary.topCategory?.category}
              />
            </div>

            <div className={CARD}>
              <h2 className="mb-3 text-base font-semibold text-text-primary">Monthly spending</h2>
              <MonthlyChart
                data={monthly}
                selectedMonth={selectedMonth}
                onSelect={(m) => {
                  setSelectedMonth(m)
                  setPage(0)
                }}
              />
            </div>

            {noResults ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
                <p className="text-sm text-text-muted">No expenses match these filters.</p>
                {hiddenByShare && (
                  <p className="mt-1 text-sm text-text-muted">
                    You aren&apos;t part of any of these expenses — try switching to Group total.
                  </p>
                )}
                <button onClick={clearFilters} className={`mt-4 ${BUTTON_SECONDARY}`}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className={CARD}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-text-primary">Expenses</h2>
                    {selectedMonth && (
                      <button
                        onClick={() => {
                          setSelectedMonth(null)
                          setPage(0)
                        }}
                        className="flex cursor-pointer items-center gap-1 rounded-full bg-neutral-bg px-3 py-1 text-xs font-medium text-neutral-text"
                        aria-label={`Clear month filter ${monthLabel(selectedMonth)}`}
                      >
                        {monthLabel(selectedMonth)}
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="-mx-5 overflow-x-auto px-5">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                          <th className="py-2 pr-3 font-medium">Date</th>
                          <th className="py-2 pr-3 font-medium">Description</th>
                          <th className="py-2 pr-3 font-medium">Group</th>
                          <th className="py-2 pr-3 font-medium">Category</th>
                          <th className="py-2 pr-3 font-medium">Paid by</th>
                          <th className="py-2 pr-3 text-right font-medium">Total</th>
                          <th className="py-2 text-right font-medium">My share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((e) => {
                          const share = sumExpenses([e], user.id).share
                          const group = groupsById[e.groupId]
                          const cat = normalizeCategory(e.category)
                          return (
                            <tr key={e.id} className="border-b border-border last:border-0">
                              <td className="whitespace-nowrap py-2.5 pr-3 text-text-secondary">
                                {formatDate(e.date)}
                              </td>
                              <td className="max-w-[160px] truncate py-2.5 pr-3 text-text-primary" title={e.description}>
                                {e.description}
                              </td>
                              <td className="max-w-[120px] truncate py-2.5 pr-3" title={group.name}>
                                <Link to={`/group/${group.id}`} className="text-primary hover:underline">
                                  {group.name}
                                </Link>
                              </td>
                              <td className="max-w-[110px] truncate py-2.5 pr-3 text-text-secondary" title={cat}>
                                {cat}
                              </td>
                              <td className="max-w-[100px] truncate py-2.5 pr-3 text-text-secondary" title={paidByLabel(e.paidBy)}>
                                {paidByLabel(e.paidBy)}
                              </td>
                              <td className="tabular-nums py-2.5 pr-3 text-right text-text-primary">
                                {formatCurrency(e.amount)}
                              </td>
                              <td className="tabular-nums py-2.5 text-right text-text-primary">
                                {formatCurrency(share)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-semibold text-text-primary">
                          <td colSpan={5} className="py-2.5 pr-3">
                            Total ({tableRows.length} expense{tableRows.length === 1 ? '' : 's'})
                          </td>
                          <td className="tabular-nums py-2.5 pr-3 text-right">{formatCurrency(footer.total)}</td>
                          <td className="tabular-nums py-2.5 text-right">{formatCurrency(footer.share)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-text-secondary">
                      Showing {safePage * PAGE_SIZE + 1}–{safePage * PAGE_SIZE + pageRows.length} of{' '}
                      {tableRows.length}
                    </p>
                    {pageCount > 1 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage(safePage - 1)}
                          disabled={safePage === 0}
                          className={`${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPage(safePage + 1)}
                          disabled={safePage >= pageCount - 1}
                          className={`${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Reports
