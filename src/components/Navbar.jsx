import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, ChevronDown, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import Avatar from './Avatar'

const ITEM =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-secondary outline-none transition-colors hover:bg-bg hover:text-text-primary focus-visible:bg-bg focus-visible:text-text-primary'

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  function close(returnFocus = false) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) menuRef.current?.querySelector('[role="menuitem"]')?.focus()
  }, [open])

  function onMenuKeyDown(e) {
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')]
    const index = items.indexOf(document.activeElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(index + 1) % items.length].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(index - 1 + items.length) % items.length].focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0].focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1].focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  function onTriggerKeyDown(e) {
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className="group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full py-1 pl-3 pr-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg hover:text-text-primary aria-expanded:bg-bg aria-expanded:text-text-primary max-sm:pl-1"
      >
        <span className="max-w-[10rem] truncate max-sm:hidden">{user.name}</span>
        <Avatar size={32} name={user.name} src={user.avatarUrl} decorative />
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="text-text-muted transition-transform duration-200 ease-out group-aria-expanded:rotate-180"
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="navbar-menu absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-xl bg-surface p-1.5 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.22),0_2px_6px_-2px_rgb(0_0_0/0.1)]"
        >
          <div className="px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-semibold text-text-primary">{user.name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" role="separator" />
          <NavLink to="/profile" role="menuitem" onClick={() => close()} className={ITEM}>
            <User size={16} aria-hidden="true" />
            Profile
          </NavLink>
          <NavLink to="/reports" role="menuitem" onClick={() => close()} className={ITEM}>
            <BarChart3 size={16} aria-hidden="true" />
            Reports
          </NavLink>
          <div className="my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              onLogout()
            }}
            className={ITEM}
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-40 h-24 border-b border-border bg-surface">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link
          to={user ? '/dashboard' : '/'}
          className="flex items-center gap-2 text-base font-bold text-text-primary"
        >
          <Logo size={78} />
          Splitmate
        </Link>
        {user && <UserMenu user={user} onLogout={handleLogout} />}
      </div>
    </nav>
  )
}

export default Navbar
