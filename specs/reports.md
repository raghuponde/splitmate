# Reports

Status: draft (spec only, nothing built)

## Summary

A protected page where a user sees their expense history across **all** their groups over
time, by month and category, and can download the rows as a CSV. Read-only: no schema
changes, no new tables, no writes.

## Route and navigation

| Path       | Page    | Auth      |
|------------|---------|-----------|
| `/reports` | Reports | protected |

- Wrapped in `ProtectedRoute`, registered in `src/App.jsx`.
- "Reports" link in `Navbar` (logged-in only) and a "View reports" link on the Dashboard.
- Centered `max-w-[680px]` column with `px-4` padding.

## Page layout

Top to bottom:

1. **Header** — title "Reports"; "Download CSV" button (`BUTTON_SECONDARY`, `Download` icon) on the right.
2. **Controls card** (`CARD`).
3. **Summary tiles** — three tiles (one column below `sm`):
   - **Total** — sum of the selected metric over the filtered set.
   - **Monthly average** — total ÷ number of months in the range (empty months count as zero).
   - **Top category** — highest-total category and its amount.
4. **Chart card** — monthly spending chart.
5. **Table card** — the expense list.

### Controls

| Control    | Type                         | Default        | Notes |
|------------|------------------------------|----------------|-------|
| Date range | Preset select + custom dates | Last 6 months  | Last 3 / 6 / 12 months, This year, All time, Custom (from/to, inclusive). Invalid `from > to` shows an inline error and keeps the previous results. |
| Group      | Select                       | All groups     | From `getGroups()`. |
| Category   | Select                       | All categories | From `CATEGORIES`. |
| Show       | Segmented toggle             | My share       | **My share** or **Group total**. |

Controls apply immediately and live in component state (no localStorage, per project
convention). Use `INPUT` for selects and date inputs.

### Chart

- **Type:** vertical stacked bars, one per calendar month in range, stacked by category.
- **Axes:** X = month (`Jan 26`; add year when the range spans years). Y = amount via
  `formatCurrency`, 3–5 round ticks.
- **Colors:** one per category, defined as theme tokens in `src/index.css` (no hardcoded
  hex). Legend lists only categories present in the data.
- **Interaction:** hover/focus a segment for a tooltip (month, category, amount). Clicking a
  bar filters the table to that month; a removable chip shows the active month.
- **Implementation:** hand-rolled SVG; no new charting dependency.
- **Accessibility:** accessible name plus per-bar `aria-label`s (or a visually hidden table).
  Color is never the only cue.
- **Responsive:** scales to container width; below `sm`, thin month labels to avoid overlap.

### Table

Columns: **Date**, **Description**, **Group**, **Category**, **Paid by**, **Total**, **My share**.

- Sorted by date desc, then `createdAt` desc (same order as `getExpenses()`).
- Amounts via `formatCurrency`. "Paid by" shows "You" for the current user.
- Client-side pagination, 25 rows per page, "Showing 1–25 of N".
- Group name links to `/group/:id`. Rows are not editable.
- Footer shows totals for the whole filtered set, not just the visible page.
- Long text truncates with ellipsis (full text in `title`).

## Data and calculations

### Sources (all through `storage.js`)

- `getExpenses()` — all non-deleted expenses in the user's groups (RLS-scoped). Because
  edits soft-delete the original, an edited expense appears once, as its latest version.
- `getGroups()` — group names and the group filter.
- `getGroupMembers(groupId)` / `getUsers()` — names for "Paid by" and "Created by".

The page never calls `supabase.from(...)`.

### Pure helpers

New `src/utils/reports.js`, no database access, unit-testable:

- `filterExpenses(expenses, { from, to, groupId, category })`
- `expenseAmountFor(expense, userId, metric)`
- `groupByMonth(expenses, userId, metric)` → `[{ month: 'YYYY-MM', total, byCategory }]`, zero-filled across the range
- `summarize(...)` → `{ total, monthlyAverage, topCategory }`
- `expensesToCsv(expenses, ctx)`

### Metrics

- **My share** (default): the `amount` of the current user's split on each expense, `0` if
  none. Expenses where the user has no split and did not pay are excluded from the table and
  chart in this mode.
- **Group total:** the expense's full `amount`; every expense in the user's groups counts.

Reports shows what was *spent*, not who owes whom. Balances stay on the group page.

### Rules

- **Date:** the expense `date`, not `createdAt`. Months are bucketed from the plain
  `YYYY-MM-DD` value with no time-zone conversion.
- **Ranges:** bounds are inclusive. "Last N months" = current month plus the previous N−1,
  from the first day of the earliest month to today. "All time" = earliest matching expense's
  month through the current month.
- **Rounding:** sum in integer cents to avoid float drift; monthly average rounds to the cent.
- **Zero checks:** use `SPLIT_EPSILON` from `utils/balance.js`, never `=== 0` / `> 0`.
- **Currency:** single currency, `formatCurrency`.
- **Top category:** ties broken by `CATEGORIES` order; shown as "—" when the total is zero.
- **Unknown/null category:** reported as "Other".

## CSV export

**What it exports:** the currently filtered set (date range, group, category). The chart's
month chip is *not* applied, so the file matches the controls. Always every row, not just the
visible page. Generated client-side from already-loaded data. Button is disabled when there are
zero rows or while loading.

**Format**
- **Name:** `splitmate-report-YYYY-MM.csv`, where `YYYY-MM` is the year and month the file is
  downloaded (local time), e.g. `splitmate-report-2026-09.csv`. It does not encode the
  selected range or filters.
- **Encoding:** UTF-8 with BOM (so Excel reads non-ASCII correctly). Lines end `\r\n`.
- **Quoting:** RFC 4180 — quote fields with commas, quotes or newlines; double embedded quotes.
- **Formula injection:** text fields starting with `=`, `+`, `-` or `@` are prefixed with `'`.
- **Amounts:** plain decimals with two places and `.` separator, no symbol or thousands
  separator (`1234.50`).
- **Dates:** `YYYY-MM-DD`.
- No summary row, so the file stays a clean table.

**Columns** (one row per expense, date descending):

| Column         | Description |
|----------------|-------------|
| `date`         | Expense date |
| `group`        | Group name |
| `description`  | Expense description |
| `category`     | Category (`Other` if unknown) |
| `paid_by`      | Payer's name |
| `total_amount` | Full expense amount |
| `my_share`     | Current user's split (`0.00` if none) |
| `split_type`   | `equal` or `manual` |
| `created_by`   | Name of the member who logged it |
| `expense_id`   | Expense UUID |

`total_amount` and `my_share` are always both present, regardless of the "Show" toggle.

## States

### Loading
Skeleton placeholders for tiles, chart and table; CSV button disabled.

### Error
If a `storage.js` call throws, show an inline "Couldn't load your reports" card with a Retry
button (bumps a local `refreshKey`, as elsewhere). Controls stay visible.

### Empty states

| Situation | Behavior |
|-----------|----------|
| User is in no groups | Body replaced by an empty card, "No groups yet", with a `BUTTON_PRIMARY` link to `/group/new`. No controls, no CSV button. |
| Groups exist but no expenses | Card: "No expenses yet — add one in a group to see reports", with links to the user's groups. CSV disabled. |
| Filters match nothing | Controls stay; chart and table replaced by "No expenses match these filters" and a "Clear filters" button. Tiles show `$0.00` and "—". CSV disabled. |
| My share mode with only expenses the user isn't part of | Same as above, with a hint to switch to "Group total". |

## Edge cases

- **Empty months** render as empty chart slots so gaps are visible.
- **One month / one expense:** one bar; monthly average equals total.
- **Long ranges:** if more than 36 months, label only each January (with year).
- **Deleted expenses:** never shown, in the UI or CSV.
- **User left a group:** `getGroups()` excludes it; Reports drops any expense whose group is
  not in the loaded group list.
- **Pending members:** have no `userId`, so they never appear as payer or in splits.
- **Unresolvable member name:** show "Unknown member".
- **Future-dated expenses:** included by custom ranges and "All time" that cover them; excluded
  from relative ranges ("Last N months", "This year" beyond today).
- **Thousands separators:** `formatCurrency` does not add them; changing that is a
  `formatCurrency` change, not a Reports change.
- **Scale:** aggregation is client-side over `getExpenses()`, fine for one user's groups. If
  slow, add server-side date filtering to `storage.js` later.
- **Freshness:** data is a snapshot from page load; revisiting the page refetches.

## Out of scope (v1)

- Editing or deleting expenses from Reports
- Multiple currencies
- PDF export or printing
- Per-member breakdowns, settlement or balance reports
- Saved or scheduled reports, sharing
- Server-side aggregation or new database objects

## Open questions

1. **Default metric:** My share vs Group total. The spec assumes "my expense history" means
   what the user personally spent. Confirm.
2. **Filters in the URL** for linkable views, or component state only?
3. **Pagination style:** page controls vs "Load more".

## Testing notes

Unit-test `utils/reports.js` once a runner exists (none does yet): month bucketing across year
boundaries, zero-filled months, cent-exact totals, both metrics, unknown-category fallback,
CSV quoting and formula-injection escaping. Manual checks: each empty state, single- and
multi-group users, an edited expense (appears once), a deleted expense (absent), and opening
the CSV in Excel with a non-ASCII description.
