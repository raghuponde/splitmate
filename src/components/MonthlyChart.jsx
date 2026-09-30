import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../utils/categories'
import { formatCurrency } from '../utils/format'
import { addMonths, monthLabel, monthsBetween } from '../utils/monthlyReport'

// Full class names so Tailwind can see them (colors are --color-cat-* tokens in index.css).
const FILL = {
  'Food & Drinks': 'fill-cat-food',
  Transport: 'fill-cat-transport',
  Accommodation: 'fill-cat-accommodation',
  Activities: 'fill-cat-activities',
  Shopping: 'fill-cat-shopping',
  Utilities: 'fill-cat-utilities',
  Other: 'fill-cat-other',
}
const SWATCH = {
  'Food & Drinks': 'bg-cat-food',
  Transport: 'bg-cat-transport',
  Accommodation: 'bg-cat-accommodation',
  Activities: 'bg-cat-activities',
  Shopping: 'bg-cat-shopping',
  Utilities: 'bg-cat-utilities',
  Other: 'bg-cat-other',
}

const H = 260
const AXIS_W = 64
const PAD = { right: 12, top: 30, bottom: 30 }
const INNER_H = H - PAD.top - PAD.bottom
const MIN_SLOT = 64 // narrowest a month may get before the chart scrolls sideways
const EMPTY_MONTHS = 6
const EMPTY_SCALE = { top: 100, ticks: [0, 50, 100] }

// Round tick values 0..top with 3-5 ticks.
function niceScale(max) {
  if (max <= 0) return EMPTY_SCALE
  const magnitude = 10 ** Math.floor(Math.log10(max))
  let step = magnitude
  for (const m of [1, 2, 2.5, 5, 10]) {
    step = m * magnitude
    if (Math.ceil(max / step) <= 4) break
  }
  const count = Math.ceil(max / step)
  return { top: step * count, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
}

// With nothing to plot, still draw EMPTY_MONTHS empty months ending at the last month in range.
function withEmptyFallback(data) {
  if (data.length === 0 || data.some((d) => d.total > 0) || data.length >= EMPTY_MONTHS) return data
  const last = data[data.length - 1].month
  return monthsBetween(addMonths(last, -(EMPTY_MONTHS - 1)), last).map((month) => ({
    month,
    total: 0,
    byCategory: {},
  }))
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

// Stacked monthly bars, one per month in `data` ([{ month, total, byCategory }]).
// Clicking (or Enter/Space on) a month toggles `selectedMonth` via `onSelect`. Months keep a
// minimum width, so long ranges scroll horizontally while the y-axis stays in place.
function MonthlyChart({ data, selectedMonth, onSelect }) {
  const [tip, setTip] = useState(null) // { month, category | null }
  const scrollRef = useRef(null)
  const viewportW = useElementWidth(scrollRef)

  const rows = withEmptyFallback(data)
  const isEmpty = rows.every((d) => d.total <= 0)
  const { top, ticks } = niceScale(Math.max(0, ...rows.map((d) => d.total)))
  const plotW = Math.max(viewportW, rows.length * MIN_SLOT + PAD.right)
  const slot = (plotW - PAD.right) / rows.length
  const barW = Math.min(slot * 0.62, 44)
  const y = (v) => PAD.top + INNER_H - (v / top) * INNER_H
  const spansYears = rows[0].month.slice(0, 4) !== rows[rows.length - 1].month.slice(0, 4)

  // Open on the most recent months when the chart overflows.
  useEffect(() => {
    const el = scrollRef.current
    if (el && plotW > el.clientWidth) el.scrollLeft = el.scrollWidth
  }, [rows.length, plotW])

  const present = CATEGORIES.filter((c) => rows.some((d) => d.byCategory[c] > 0))
  const tipMonth = tip && rows.find((d) => d.month === tip.month)
  const tipIndex = tip ? rows.findIndex((d) => d.month === tip.month) : -1
  const tipLeft = tip ? Math.min(plotW - 90, Math.max(90, slot * (tipIndex + 0.5))) : 0

  return (
    <div>
      <div className="flex">
        <svg width={AXIS_W} height={H} aria-hidden="true" className="block shrink-0">
          {ticks.map((t) => (
            <text key={t} x={AXIS_W - 8} y={y(t) + 4} textAnchor="end" className="fill-text-muted text-[11px]">
              {formatCurrency(t)}
            </text>
          ))}
        </svg>

        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: plotW }}>
            <svg
              width={plotW}
              height={H}
              role="group"
              aria-label="Monthly spending by category"
              className="block"
            >
              {ticks.map((t) => (
                <line key={t} x1={0} x2={plotW} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
              ))}

              {rows.map((d, i) => {
                const x = slot * i
                const cx = x + slot / 2
                const interactive = d.total > 0
                const selected = selectedMonth === d.month
                const dimmed = selectedMonth && !selected

                let acc = 0
                const segments = CATEGORIES.filter((c) => d.byCategory[c] > 0).map((c) => {
                  const from = acc
                  acc += d.byCategory[c]
                  return { category: c, amount: d.byCategory[c], y0: y(from), y1: y(acc) }
                })

                const summary = `${monthLabel(d.month)}: ${formatCurrency(d.total)}${segments
                  .map((s) => `, ${s.category} ${formatCurrency(s.amount)}`)
                  .join('')}`

                return (
                  <g
                    key={d.month}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={interactive ? summary : undefined}
                    aria-pressed={interactive ? selected : undefined}
                    className={interactive ? 'cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-primary' : undefined}
                    onClick={interactive ? () => onSelect(selected ? null : d.month) : undefined}
                    onKeyDown={
                      interactive
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onSelect(selected ? null : d.month)
                            }
                          }
                        : undefined
                    }
                    onMouseEnter={interactive ? () => setTip({ month: d.month, category: null }) : undefined}
                    onMouseLeave={interactive ? () => setTip(null) : undefined}
                    onFocus={interactive ? () => setTip({ month: d.month, category: null }) : undefined}
                    onBlur={interactive ? () => setTip(null) : undefined}
                  >
                    <rect
                      x={x}
                      y={PAD.top}
                      width={slot}
                      height={INNER_H}
                      rx="4"
                      strokeWidth="2"
                      className={`${selected ? 'fill-primary/10' : 'fill-transparent'} stroke-transparent`}
                    />
                    {segments.map((s) => (
                      <rect
                        key={s.category}
                        x={cx - barW / 2}
                        y={s.y1}
                        width={barW}
                        height={Math.max(s.y0 - s.y1, 0)}
                        aria-hidden="true"
                        className={`${FILL[s.category]} ${dimmed ? 'opacity-40' : ''}`}
                        onMouseEnter={() => setTip({ month: d.month, category: s.category })}
                        onMouseLeave={() => setTip({ month: d.month, category: null })}
                      />
                    ))}
                    {interactive && (
                      <text
                        x={cx}
                        y={y(d.total) - 6}
                        textAnchor="middle"
                        aria-hidden="true"
                        className={`tabular-nums fill-text-primary text-[11px] font-semibold ${dimmed ? 'opacity-40' : ''}`}
                      >
                        {formatCurrency(d.total)}
                      </text>
                    )}
                    <text x={cx} y={H - 10} textAnchor="middle" className="fill-text-secondary text-[11px]">
                      {monthLabel(d.month, spansYears)}
                    </text>
                  </g>
                )
              })}
            </svg>

            {isEmpty && (
              <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-text-muted">
                No spending in this period
              </p>
            )}

            {tipMonth && (
              <div
                role="status"
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                style={{ left: tipLeft }}
              >
                <p className="font-semibold text-text-primary">{monthLabel(tipMonth.month)}</p>
                {tip.category ? (
                  <p className="tabular-nums text-text-secondary">
                    {tip.category}: {formatCurrency(tipMonth.byCategory[tip.category] || 0)}
                  </p>
                ) : (
                  <>
                    {CATEGORIES.filter((c) => tipMonth.byCategory[c] > 0).map((c) => (
                      <p key={c} className="tabular-nums text-text-secondary">
                        {c}: {formatCurrency(tipMonth.byCategory[c])}
                      </p>
                    ))}
                    <p className="tabular-nums mt-1 font-semibold text-text-primary">
                      Total: {formatCurrency(tipMonth.total)}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {present.map((c) => (
          <li key={c} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${SWATCH[c]}`} aria-hidden="true" />
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MonthlyChart
