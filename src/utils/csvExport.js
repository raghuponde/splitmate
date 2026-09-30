// CSV export for the Reports page — pure string building plus one browser download helper.
// Format: UTF-8 with BOM (so Excel reads non-ASCII text), CRLF line endings, RFC 4180 quoting.

import { normalizeCategory, toCents } from './monthlyReport'

const BOM = '﻿'
const EOL = '\r\n'

const HEADERS = [
  'date',
  'group',
  'description',
  'category',
  'paid_by',
  'total_amount',
  'my_share',
  'split_type',
  'created_by',
  'expense_id',
]

// Text starting with = + - @ would be run as a formula by spreadsheets; prefix a quote.
function neutralize(text) {
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

// Quotes a field containing a comma, quote or newline, doubling embedded quotes.
function quote(field) {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

function text(value) {
  return quote(neutralize(String(value ?? '')))
}

// Plain decimal, two places, '.' separator, no symbol or thousands separator.
function amount(cents) {
  return (cents / 100).toFixed(2)
}

// Builds the CSV for the given expenses, one row per expense in the order given.
// ctx: { userId, groupName(groupId) -> string, memberName(userId) -> string }
export function expensesToCsv(expenses, { userId, groupName, memberName }) {
  const rows = expenses.map((e) => {
    let shareCents = 0
    for (const s of e.splits) if (s.userId === userId) shareCents += toCents(s.amount)

    return [
      e.date.slice(0, 10),
      text(groupName(e.groupId)),
      text(e.description),
      text(normalizeCategory(e.category)),
      text(memberName(e.paidBy)),
      amount(toCents(e.amount)),
      amount(shareCents),
      text(e.splitType),
      text(memberName(e.createdBy)),
      e.id,
    ].join(',')
  })
  return BOM + [HEADERS.join(','), ...rows].join(EOL) + EOL
}

// 'splitmate-report-YYYY-MM.csv' for the month the file is downloaded (local time).
export function csvFilename(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `splitmate-report-${now.getFullYear()}-${month}.csv`
}

export function downloadCsv(csv, filename = csvFilename()) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
