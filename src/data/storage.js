// Supabase-backed data layer for Splitmate.
// This is the ONLY module (besides supabaseClient.js) that talks to the database.
// Auth (sign in / sign up / session) lives in context/AuthContext.jsx.
//
// Function names match the old localStorage version, but every function is now async.
// Row-Level Security limits all reads and writes to the groups the signed-in user
// belongs to. The app-facing object shapes are unchanged:
//   User    { id, name, email }
//   Group   { id, name, memberIds: [userId], pendingEmails: [email], createdBy: userId, createdAt }
//   Expense { id, groupId, description, amount, paidBy: userId, splits: [{ userId, amount }],
//             splitType: 'equal' | 'manual', date, createdAt, isDeleted, createdBy: userId,
//             category: string }

import { supabase } from './supabaseClient'
import { calculateNetBalances as calcNetBalances, simplifyDebts as simplifyDebtsFor } from '../utils/balance'
import { DEFAULT_CATEGORY } from '../utils/categories'

function check({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

function toGroup(row) {
  return {
    id: row.id,
    name: row.name,
    memberIds: (row.group_members || []).map((m) => m.user_id),
    pendingEmails: (row.group_pending_invites || []).map((i) => i.email),
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function toExpense(row) {
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    splits: (row.expense_splits || []).map((s) => ({ userId: s.user_id, amount: Number(s.amount) })),
    splitType: row.split_type,
    date: row.date,
    createdAt: row.created_at,
    isDeleted: row.is_deleted,
    createdBy: row.created_by,
    category: row.category,
  }
}

const GROUP_SELECT = '*, group_members(user_id), group_pending_invites(email)'

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

// --- Users ---

// Profiles visible to the signed-in user (themselves + people they share a group with).
export async function getUsers() {
  const rows = check(await supabase.from('profiles').select('id, name, email'))
  return rows
}

export async function getUserById(id) {
  const row = check(
    await supabase.from('profiles').select('id, name, email').eq('id', id).maybeSingle()
  )
  return row || null
}

// Finds a registered user by email (any user, not only people you share a group with).
export async function getUserByEmail(email) {
  const rows = check(await supabase.rpc('find_profile_by_email', { p_email: email }))
  return rows && rows.length > 0 ? { id: rows[0].id, name: rows[0].name } : null
}

// Returns the [{ id, name }] profiles of a group's active members.
export async function getGroupMembers(groupId) {
  const rows = check(
    await supabase.from('group_members').select('profiles(id, name)').eq('group_id', groupId)
  )
  return rows.map((r) => r.profiles).filter(Boolean)
}

// --- Groups ---

export async function getGroupById(id) {
  const row = check(await supabase.from('groups').select(GROUP_SELECT).eq('id', id).maybeSingle())
  return row ? toGroup(row) : null
}

// Groups the signed-in user belongs to, each with both active members (memberIds)
// and pending invites (pendingEmails). RLS already hides other users' groups; the
// membership filter also excludes a group the user created but has since left.
export async function getGroups() {
  const [uid, rows] = await Promise.all([
    currentUserId(),
    supabase
      .from('groups')
      .select(GROUP_SELECT)
      .order('created_at', { ascending: false })
      .then(check),
  ])
  return rows.map(toGroup).filter((g) => g.memberIds.includes(uid))
}

export async function getGroupsForUser(userId) {
  const groups = await getGroups()
  return userId ? groups.filter((g) => g.memberIds.includes(userId)) : groups
}

export async function createGroup({ name, memberIds, pendingEmails, createdBy }) {
  const group = check(
    await supabase.from('groups').insert({ name, created_by: createdBy }).select('id').single()
  )

  const allMemberIds = Array.from(new Set([...(memberIds || []), createdBy]))
  check(
    await supabase
      .from('group_members')
      .insert(allMemberIds.map((userId) => ({ group_id: group.id, user_id: userId })))
  )

  const emails = Array.from(new Set(pendingEmails || []))
  if (emails.length > 0) {
    check(
      await supabase
        .from('group_pending_invites')
        .insert(emails.map((email) => ({ group_id: group.id, email, invited_by: createdBy })))
    )
  }

  return getGroupById(group.id)
}

// --- Expenses ---

// All non-deleted expenses across the signed-in user's groups.
export async function getExpenses() {
  const rows = check(
    await supabase
      .from('expenses')
      .select('*, expense_splits(user_id, amount)')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
  )
  return rows.map(toExpense)
}

export async function getExpensesForGroup(groupId) {
  const rows = check(
    await supabase
      .from('expenses')
      .select('*, expense_splits(user_id, amount)')
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
  )
  return rows.map(toExpense)
}

// `splits` must be [{ userId, amount }] summing to `amount`; `splitType` records
// whether they came from an equal or manual split in the Add Expense modal.
// The expense and its splits are written atomically by the save_expense function.
// (`createdBy` is always the signed-in user, enforced by the database.)
export async function createExpense({ groupId, description, amount, paidBy, splits, splitType, date, category }) {
  return callSaveExpense({ groupId, description, amount, paidBy, splits, splitType, date, category })
}

// Soft-deletes the expense; history stays intact for balance calculations.
export async function deleteExpense(expenseId) {
  check(await supabase.from('expenses').update({ is_deleted: true }).eq('id', expenseId))
}

// Edits an expense by soft-deleting the original and creating a new one with the
// updated fields, preserving the original creator (all in one transaction).
export async function editExpense(expenseId, { groupId, description, amount, paidBy, splits, splitType, date, category }) {
  return callSaveExpense({
    groupId,
    description,
    amount,
    paidBy,
    splits,
    splitType,
    date,
    category,
    replaces: expenseId,
  })
}

async function callSaveExpense({ groupId, description, amount, paidBy, splits, splitType, date, category, replaces }) {
  return check(
    await supabase.rpc('save_expense', {
      p_group_id: groupId,
      p_description: description,
      p_amount: amount,
      p_paid_by: paidBy,
      p_split_type: splitType,
      p_date: date || new Date().toISOString().slice(0, 10),
      p_category: category || DEFAULT_CATEGORY,
      p_splits: splits,
      p_replaces: replaces ?? null,
    })
  )
}

// --- Balances ---

// Returns { [userId]: netAmount } for a group, excluding soft-deleted expenses.
// Positive netAmount means that user is owed money overall.
export async function calculateNetBalances(groupId) {
  return calcNetBalances(await getExpensesForGroup(groupId))
}

// Simplifies debts into the minimum number of payments.
// Returns an array of { from: userId, to: userId, amount } meaning
// `from` owes `to` `amount`.
export async function simplifyDebts(groupId) {
  return simplifyDebtsFor(await calculateNetBalances(groupId))
}

// --- Profile ---

const AVATAR_BUCKET = 'avatars'
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_TYPES = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] }

function avatarPublicUrl(path) {
  if (!path) return null
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

function isSessionError(error) {
  return error && (error.status === 401 || /jwt/i.test(error.message || ''))
}

// Returns { id, name, email, avatarUrl } for the signed-in user (avatarUrl is null with no photo).
export async function getMyProfile() {
  const id = await currentUserId()
  if (!id) return null
  const row = check(
    await supabase.from('profiles').select('id, name, email, avatar_url').eq('id', id).maybeSingle()
  )
  if (!row) return null
  return { id: row.id, name: row.name, email: row.email, avatarUrl: avatarPublicUrl(row.avatar_url) }
}

export async function updateProfileName(name) {
  const id = await currentUserId()
  if (!id) throw new Error('Your session has expired. Sign in again.')
  check(await supabase.from('profiles').update({ name }).eq('id', id))
}

// Uploads to avatars/<uid>/avatar.<ext>, saves the path on the profile and returns the public URL.
export async function uploadAvatar(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (!AVATAR_TYPES[file.type]?.includes(ext)) throw new Error('Use a JPG, PNG or WebP image.')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('That image is too large. Maximum size is 2 MB.')

  const id = await currentUserId()
  if (!id) throw new Error('Your session has expired. Sign in again.')
  const path = `${id}/avatar.${ext === 'jpeg' ? 'jpg' : ext}`

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) {
    throw new Error(
      isSessionError(error)
        ? 'Your session has expired. Sign in again.'
        : "Couldn't upload your photo. Please try again."
    )
  }

  const old = check(await supabase.from('profiles').select('avatar_url').eq('id', id).maybeSingle())
  try {
    check(await supabase.from('profiles').update({ avatar_url: path }).eq('id', id))
  } catch {
    throw new Error("Couldn't upload your photo. Please try again.")
  }
  if (old?.avatar_url && old.avatar_url !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([old.avatar_url])
  }
  return avatarPublicUrl(path)
}

export async function removeAvatar() {
  const id = await currentUserId()
  if (!id) throw new Error('Your session has expired. Sign in again.')
  try {
    const row = check(await supabase.from('profiles').select('avatar_url').eq('id', id).maybeSingle())
    if (row?.avatar_url) {
      const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([row.avatar_url])
      if (error) throw error
    }
    check(await supabase.from('profiles').update({ avatar_url: null }).eq('id', id))
  } catch {
    throw new Error("Couldn't remove your photo. Please try again.")
  }
}
