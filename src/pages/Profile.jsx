import useDocumentTitle from '../utils/useDocumentTitle'
import { useEffect, useRef, useState } from 'react'
import { Camera, Eye, EyeOff, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as storage from '../data/storage'
import Navbar from '../components/Navbar'
import Avatar from '../components/Avatar'
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT } from '../utils/styles'

const MAX_NAME = 50
const MIN_PASSWORD = 8
const MAX_PASSWORD = 72
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const PHOTO_TYPES = { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] }
const REFRESH_FAILED = "Saved, but couldn't refresh. Reload the page."
const INPUT_CLASS = `${INPUT} !text-base sm:!text-sm`
const LABEL = 'mb-1 block text-sm font-medium text-text-primary'
const FIELD_ERROR = 'mt-1 text-sm text-negative-text'
const MOBILE_BTN = 'min-h-11 w-full sm:min-h-0 sm:w-auto'

// Auto-clearing status message (~4 s).
function useFlash() {
  const [message, setMessage] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  function flash(text) {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(''), 4000)
  }
  return [message, flash]
}

function validateName(value) {
  const name = value.trim()
  if (!name) return 'Enter your name.'
  if (name.length > MAX_NAME) return 'Name must be 50 characters or fewer.'
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F-\u009F]/.test(name)) return 'Name contains invalid characters.'
  return ''
}

function validatePhoto(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (!PHOTO_TYPES[file.type]?.includes(ext)) return 'Use a JPG, PNG or WebP image.'
  if (file.size > MAX_PHOTO_BYTES) return 'That image is too large. Maximum size is 2 MB.'
  return ''
}

function validatePassword(field, { current, next, confirm }) {
  if (field === 'current') return current ? '' : 'Enter your current password.'
  if (field === 'new') {
    if (!next) return 'Enter a new password.'
    if (next.length < MIN_PASSWORD) return 'Password must be at least 8 characters.'
    if (next.length > MAX_PASSWORD) return 'Password must be 72 characters or fewer.'
    if (next === current) return 'New password must be different from your current password.'
    return ''
  }
  if (!confirm) return 'Confirm your new password.'
  return confirm === next ? '' : "Passwords don't match."
}

function PhotoSection({ user, refreshUser }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [success, flash] = useFlash()

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  async function refresh(message) {
    try {
      await refreshUser()
      flash(message)
    } catch {
      setError(REFRESH_FAILED)
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    const problem = validatePhoto(file)
    if (problem) {
      setError(problem)
      return
    }
    setPreview(URL.createObjectURL(file))
    setBusy(true)
    try {
      await storage.uploadAvatar(file)
      await refresh('Photo updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setPreview(null)
      setBusy(false)
    }
  }

  async function handleRemove() {
    setConfirming(false)
    setError('')
    setBusy(true)
    try {
      await storage.removeAvatar()
      await refresh('Photo removed')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const hasPhoto = Boolean(user.avatarUrl)

  return (
    <div className="flex flex-col items-center gap-3 sm:items-start">
      <div className="relative">
        <Avatar size={96} name={user.name} src={preview || user.avatarUrl} decorative />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleFile}
      />
      {confirming ? (
        <div className="flex w-full flex-col items-center gap-2 sm:flex-row">
          <span className="text-sm text-text-primary">Remove your photo?</span>
          <button type="button" onClick={handleRemove} className={`${MOBILE_BTN} ${BUTTON_SECONDARY}`}>
            Remove
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={`${MOBILE_BTN} ${BUTTON_SECONDARY}`}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={`flex items-center justify-center gap-2 ${MOBILE_BTN} ${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Camera size={16} />
            {hasPhoto ? 'Change photo' : 'Upload photo'}
          </button>
          {hasPhoto && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className={`${MOBILE_BTN} ${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Remove photo
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-negative-text">
          {error}
        </p>
      )}
      <p aria-live="polite" className="text-sm text-positive-text empty:hidden">
        {success}
      </p>
    </div>
  )
}

function NameForm({ user, updateName, refreshUser }) {
  const [value, setValue] = useState(user.name)
  const [touched, setTouched] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, flash] = useFlash()
  const inputRef = useRef(null)

  const unchanged = value.trim() === user.name
  const invalid = Boolean(validateName(value))

  function handleChange(e) {
    setValue(e.target.value)
    setFieldError('')
    setRequestError('')
  }

  function handleBlur() {
    setTouched(true)
    setFieldError(validateName(value))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setTouched(true)
    const problem = validateName(value)
    setFieldError(problem)
    setRequestError('')
    if (problem) {
      inputRef.current?.focus()
      return
    }
    const trimmed = value.trim()
    setSaving(true)
    try {
      await updateName(trimmed)
    } catch (err) {
      setRequestError(err.message)
      setSaving(false)
      return
    }
    try {
      await refreshUser()
      setValue(trimmed)
      flash('Name updated')
    } catch {
      setRequestError(REFRESH_FAILED)
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="profile-name" className={LABEL}>
        Display name
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="profile-name"
          ref={inputRef}
          type="text"
          value={value}
          maxLength={MAX_NAME}
          autoComplete="name"
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={fieldError ? 'true' : undefined}
          aria-describedby={fieldError ? 'profile-name-error' : undefined}
          className={`${INPUT_CLASS} sm:flex-1`}
        />
        <button
          type="submit"
          disabled={saving || unchanged || (touched && invalid)}
          className={`${MOBILE_BTN} ${BUTTON_PRIMARY}`}
        >
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </div>
      {fieldError && (
        <p id="profile-name-error" className={FIELD_ERROR}>
          {fieldError}
        </p>
      )}
      {requestError && (
        <p role="alert" className={FIELD_ERROR}>
          {requestError}
        </p>
      )}
      <p aria-live="polite" className="mt-2 text-sm text-positive-text empty:hidden">
        {success}
      </p>
    </form>
  )
}

function PasswordField({ id, label, autoComplete, value, error, shown, onToggle, onChange, onBlur, inputRef }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type={shown ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${INPUT_CLASS} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-text-muted hover:text-text-primary"
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className={FIELD_ERROR}>
          {error}
        </p>
      )}
    </div>
  )
}

const EMPTY_FIELDS = { current: '', next: '', confirm: '' }
const NO_ERRORS = { current: '', new: '', confirm: '' }
const NOT_TOUCHED = { current: false, new: false, confirm: false }
const HIDDEN = { current: false, next: false, confirm: false }

function PasswordForm({ changePassword }) {
  const [values, setValues] = useState(EMPTY_FIELDS)
  const [errors, setErrors] = useState(NO_ERRORS)
  const [touched, setTouched] = useState(NOT_TOUCHED)
  const [shown, setShown] = useState(HIDDEN)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, flash] = useFlash()
  const refs = { current: useRef(null), new: useRef(null), confirm: useRef(null) }
  const successRef = useRef(null)

  function handleChange(key, field) {
    return (e) => {
      const next = { ...values, [key]: e.target.value }
      setValues(next)
      setFormError('')
      setErrors((prev) => {
        const updated = { ...prev, [field]: '' }
        // Re-check confirm when the new password changes.
        if (field === 'new' && touched.confirm && next.confirm) {
          updated.confirm = validatePassword('confirm', next)
        }
        return updated
      })
    }
  }

  function handleBlur(field) {
    return () => {
      setTouched((prev) => ({ ...prev, [field]: true }))
      setErrors((prev) => ({ ...prev, [field]: validatePassword(field, values) }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setFormError('')
    const found = {
      current: validatePassword('current', values),
      new: validatePassword('new', values),
      confirm: validatePassword('confirm', values),
    }
    setErrors(found)
    setTouched({ current: true, new: true, confirm: true })
    const firstInvalid = ['current', 'new', 'confirm'].find((f) => found[f])
    if (firstInvalid) {
      refs[firstInvalid].current?.focus()
      return
    }

    setSaving(true)
    try {
      await changePassword(values.current, values.next)
      setValues(EMPTY_FIELDS)
      setShown(HIDDEN)
      setTouched(NOT_TOUCHED)
      flash('Password updated')
      setTimeout(() => successRef.current?.focus(), 0)
    } catch (err) {
      if (err.field === 'current') {
        setValues((prev) => ({ ...prev, current: '' }))
        setErrors((prev) => ({ ...prev, current: err.message }))
        refs.current.current?.focus()
      } else if (err.field === 'new') {
        setErrors((prev) => ({ ...prev, new: err.message }))
        refs.new.current?.focus()
      } else {
        setFormError(err.message)
      }
    }
    setSaving(false)
  }

  const toggle = (key) => () => setShown((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <PasswordField
        id="profile-current-password"
        label="Current password"
        autoComplete="current-password"
        value={values.current}
        error={errors.current}
        shown={shown.current}
        onToggle={toggle('current')}
        onChange={handleChange('current', 'current')}
        onBlur={handleBlur('current')}
        inputRef={refs.current}
      />
      <PasswordField
        id="profile-new-password"
        label="New password"
        autoComplete="new-password"
        value={values.next}
        error={errors.new}
        shown={shown.next}
        onToggle={toggle('next')}
        onChange={handleChange('next', 'new')}
        onBlur={handleBlur('new')}
        inputRef={refs.new}
      />
      <PasswordField
        id="profile-confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        value={values.confirm}
        error={errors.confirm}
        shown={shown.confirm}
        onToggle={toggle('confirm')}
        onChange={handleChange('confirm', 'confirm')}
        onBlur={handleBlur('confirm')}
        inputRef={refs.confirm}
      />
      {formError && (
        <p role="alert" className="text-sm text-negative-text">
          {formError}
        </p>
      )}
      <button type="submit" disabled={saving} className={`${MOBILE_BTN} ${BUTTON_PRIMARY}`}>
        {saving ? 'Updating…' : 'Update password'}
      </button>
      <p
        ref={successRef}
        tabIndex={-1}
        aria-live="polite"
        className="text-sm text-positive-text outline-none empty:hidden"
      >
        {success}
      </p>
    </form>
  )
}

function Profile() {
  useDocumentTitle('Profile')
  const { user, refreshUser, updateName, changePassword } = useAuth()

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="mx-auto max-w-[680px] px-4 py-8">
        <h1 className="mb-4 text-xl font-bold text-text-primary">Profile</h1>
        <div className="space-y-4">
          <section className={CARD} aria-labelledby="account-heading">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
              <PhotoSection user={user} refreshUser={refreshUser} />
              <div className="min-w-0">
                <h2 id="account-heading" className="break-words text-lg font-semibold text-text-primary">
                  {user.name}
                </h2>
                <p className="mt-2 flex items-center justify-center gap-1.5 break-all text-sm text-text-secondary sm:justify-start">
                  <Lock size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
                  {user.email}
                </p>
                <p className="mt-1 text-xs text-text-muted">Your email can&apos;t be changed.</p>
                <p className="mt-2 text-sm text-text-secondary">Member since {joined}</p>
              </div>
            </div>
          </section>

          <section className={CARD} aria-labelledby="name-heading">
            <h2 id="name-heading" className="mb-3 text-base font-semibold text-text-primary">
              Name
            </h2>
            <NameForm user={user} updateName={updateName} refreshUser={refreshUser} />
          </section>

          <section className={CARD} aria-labelledby="password-heading">
            <h2 id="password-heading" className="mb-3 text-base font-semibold text-text-primary">
              Change password
            </h2>
            <PasswordForm changePassword={changePassword} />
          </section>
        </div>
      </div>
    </div>
  )
}

export default Profile
