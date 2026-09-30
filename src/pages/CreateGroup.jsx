import useDocumentTitle from '../utils/useDocumentTitle'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as storage from '../data/storage'
import Navbar from '../components/Navbar'
import { BADGE_PENDING, BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT } from '../utils/styles'

function CreateGroup() {
  useDocumentTitle('New Group')
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [members, setMembers] = useState([]) // { email, userId: string|null }
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAddMember(e) {
    e.preventDefault()
    const email = emailInput.trim().toLowerCase()
    if (!email) return

    if (email === user.email.toLowerCase()) {
      setError("You're already in this group.")
      return
    }
    if (members.some((m) => m.email === email)) {
      setError('That email has already been added.')
      return
    }

    try {
      const existingUser = await storage.getUserByEmail(email)
      setMembers((prev) =>
        prev.some((m) => m.email === email)
          ? prev
          : [...prev, { email, userId: existingUser ? existingUser.id : null, name: existingUser?.name }]
      )
      setEmailInput('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  function handleRemoveMember(email) {
    setMembers((prev) => prev.filter((m) => m.email !== email))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter a group name.')
      return
    }

    const memberIds = members.filter((m) => m.userId).map((m) => m.userId)
    const pendingEmails = members.filter((m) => !m.userId).map((m) => m.email)

    setSaving(true)
    try {
      const group = await storage.createGroup({
        name: name.trim(),
        memberIds,
        pendingEmails,
        createdBy: user.id,
      })
      navigate(`/group/${group.id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-xl font-bold text-text-primary">Create a group</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT}
              placeholder="Goa trip, Apartment 4B..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Add members by email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMember(e)
                }}
                className={INPUT}
                placeholder="friend@example.com"
              />
              <button type="button" onClick={handleAddMember} className={BUTTON_SECONDARY}>
                Add
              </button>
            </div>

            <p className="mt-2 text-sm text-text-muted">You&apos;ll be added automatically.</p>

            {members.length > 0 && (
              <ul className="mt-3 space-y-2">
                {members.map((m) => (
                  <li
                    key={m.email}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2 text-text-primary">
                      {m.name || m.email}
                      {!m.userId && <span className={BADGE_PENDING}>pending</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.email)}
                      className="cursor-pointer text-text-muted transition-colors hover:text-danger"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-negative-text">{error}</p>}

          <button type="submit" disabled={saving} className={`w-full ${BUTTON_PRIMARY}`}>
            {saving ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CreateGroup
