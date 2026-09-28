// localStorage-backed data layer for Splitmate.
// This is the ONLY module that reads or writes localStorage directly.
//
// Data model:
//   User    { id, name, email, password }
//   Group   { id, name, memberIds: [userId], pendingEmails: [email], createdBy: userId, createdAt }
//   Expense { id, groupId, description, amount, paidBy: userId, splits: [{ userId, amount }],
//             splitType: 'equal' | 'manual', date, createdAt, isDeleted }

import { computeEqualSplits, calculateNetBalances as calcNetBalances, simplifyDebts as simplifyDebtsFor } from '../utils/balance'

const KEYS = {
  USERS: 'splitmate_users',
  GROUPS: 'splitmate_groups',
  EXPENSES: 'splitmate_expenses',
  CURRENT_USER_ID: 'splitmate_current_user_id',
  SEEDED: 'splitmate_seeded',
}

function read(key) {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : []
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function generateId() {
  return crypto.randomUUID()
}

// Upgrades expenses stored under the old shape (splitBetween: [userId], implicit
// equal split) to the current shape (splits: [{ userId, amount }], splitType).
function normalizeExpense(expense) {
  if (expense.splits) return expense
  const { splitBetween, ...rest } = expense
  return {
    ...rest,
    splits: computeEqualSplits(expense.amount, splitBetween || []),
    splitType: 'equal',
  }
}

// --- Seed data ---

export function seedTestAccountsIfNeeded() {
  if (localStorage.getItem(KEYS.SEEDED)) return

  const testUsers = [
    { name: 'Shubham', email: 'shubham@test.com', password: 'password' },
    { name: 'Bob', email: 'bob@test.com', password: 'password' },
    { name: 'Rahul', email: 'rahul@test.com', password: 'password' },
    { name: 'Eva', email: 'eva@test.com', password: 'password' },
  ]

  const users = getUsers()
  for (const t of testUsers) {
    if (!users.some((u) => u.email === t.email)) {
      users.push({ id: generateId(), ...t })
    }
  }
  write(KEYS.USERS, users)
  localStorage.setItem(KEYS.SEEDED, 'true')
}

// --- Users ---

export function getUsers() {
  return read(KEYS.USERS)
}

export function getUserById(id) {
  return getUsers().find((u) => u.id === id) || null
}

export function getUserByEmail(email) {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
}

export function createUser({ name, email, password }) {
  const users = getUsers()
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('A user with this email already exists')
  }
  const user = { id: generateId(), name, email, password }
  write(KEYS.USERS, [...users, user])

  // Promote any pending memberships that used this email to active membership.
  const groups = getGroups()
  let groupsChanged = false
  const updatedGroups = groups.map((g) => {
    const pending = g.pendingEmails || []
    if (pending.some((e) => e.toLowerCase() === email.toLowerCase())) {
      groupsChanged = true
      return {
        ...g,
        memberIds: Array.from(new Set([...g.memberIds, user.id])),
        pendingEmails: pending.filter((e) => e.toLowerCase() !== email.toLowerCase()),
      }
    }
    return g
  })
  if (groupsChanged) write(KEYS.GROUPS, updatedGroups)

  return user
}

// --- Session ---

export function getCurrentUser() {
  const id = localStorage.getItem(KEYS.CURRENT_USER_ID)
  return id ? getUserById(id) : null
}

export function setCurrentUser(userId) {
  localStorage.setItem(KEYS.CURRENT_USER_ID, userId)
}

export function clearCurrentUser() {
  localStorage.removeItem(KEYS.CURRENT_USER_ID)
}

// --- Groups ---

export function getGroups() {
  return read(KEYS.GROUPS)
}

export function getGroupById(id) {
  return getGroups().find((g) => g.id === id) || null
}

export function getGroupsForUser(userId) {
  return getGroups().filter((g) => g.memberIds.includes(userId))
}

export function createGroup({ name, memberIds, pendingEmails, createdBy }) {
  const groups = getGroups()
  const group = {
    id: generateId(),
    name,
    memberIds: Array.from(new Set([...(memberIds || []), createdBy])),
    pendingEmails: Array.from(new Set(pendingEmails || [])),
    createdBy,
    createdAt: new Date().toISOString(),
  }
  write(KEYS.GROUPS, [...groups, group])
  return group
}

// --- Expenses ---

export function getExpenses() {
  return read(KEYS.EXPENSES).map(normalizeExpense)
}

export function getExpensesForGroup(groupId) {
  return getExpenses().filter((e) => e.groupId === groupId && !e.isDeleted)
}

// `splits` must be [{ userId, amount }] summing to `amount`; `splitType` records
// whether they came from an equal or manual split in the Add Expense modal.
export function createExpense({ groupId, description, amount, paidBy, splits, splitType, date }) {
  const expenses = getExpenses()
  const expense = {
    id: generateId(),
    groupId,
    description,
    amount,
    paidBy,
    splits,
    splitType,
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    isDeleted: false,
  }
  write(KEYS.EXPENSES, [...expenses, expense])
  return expense
}

export function deleteExpense(expenseId) {
  const expenses = getExpenses()
  write(
    KEYS.EXPENSES,
    expenses.map((e) => (e.id === expenseId ? { ...e, isDeleted: true } : e))
  )
}

// --- Balances ---

// Returns { [userId]: netAmount } for a group, excluding soft-deleted expenses.
// Positive netAmount means that user is owed money overall.
// Negative netAmount means that user owes money overall.
export function calculateNetBalances(groupId) {
  return calcNetBalances(getExpensesForGroup(groupId))
}

// Simplifies debts into the minimum number of payments.
// Returns an array of { from: userId, to: userId, amount } meaning
// `from` owes `to` `amount`.
export function simplifyDebts(groupId) {
  return simplifyDebtsFor(calculateNetBalances(groupId))
}
