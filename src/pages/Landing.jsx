import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowDown,
  ArrowRightLeft,
  LogIn,
  UserPlus,
  History,
  Smartphone,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { BUTTON_PRIMARY } from '../utils/styles'
import { formatCurrency } from '../utils/format'
import Logo from '../components/Logo'

const STEPS = [
  {
    n: '01',
    title: 'Create a group',
    body: 'Add roommates, trip mates, or anyone splitting costs with you — invite by email even before they sign up.',
  },
  {
    n: '02',
    title: 'Log an expense',
    body: 'Enter what was spent and who paid. Split it evenly or set custom shares; Splitmate does the arithmetic.',
  },
  {
    n: '03',
    title: 'Settle up',
    body: 'Splitmate collapses every IOU into the fewest payments possible, so settling up takes one transfer, not five.',
  },
]

const FEATURES = [
  {
    icon: UserPlus,
    title: 'Invite before they join',
    body: "Add someone by email and they're pulled into the group the moment they register — no waiting on everyone to sign up first.",
  },
  {
    icon: ArrowRightLeft,
    title: 'Fewest-payment settlements',
    body: 'Splitmate reduces a tangle of IOUs to the smallest possible set of payments, automatically, every time a balance changes.',
  },
  {
    icon: History,
    title: 'A history that holds up',
    body: 'Edits never erase the past. Past expenses stay on record so old balances stay correct even after something changes.',
  },
  {
    icon: Smartphone,
    title: 'Works everywhere',
    body: 'No install, no account syncing, no backend to babysit. Open it on your phone between rounds or on your laptop after.',
  },
]

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function DemoAvatar({ name }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-semibold text-stone-600">
      {initials(name)}
    </span>
  )
}

function Landing() {
  useEffect(() => {
    document.title = 'Splitmate — Split expenses, not friendships'
  }, [])

  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [loading, user, navigate])

  return (
    <div className="bg-bg">
      {/* Nav */}
      <div className="border-b border-border/70">
        <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-2 text-base font-bold text-text-primary">
            <Logo size={78} />
            Splitmate
          </span>
          <div className="flex items-center gap-5">
            <Link
              to="/login"
              className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              <LogIn size={16} />
              Sign in
            </Link>
            <Link to="/register" className={`${BUTTON_PRIMARY} !px-3.5 !py-2 text-sm`}>
              Get started
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-text-primary sm:text-5xl lg:text-[3.4rem]">
            Everyone paid
            <br />
            something. Only
            <br />
            <span className="text-primary">one number</span> matters.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-text-secondary">
            Splitmate tracks who paid what across your group, then works out the fewest
            payments it takes to settle up. No spreadsheets, no chasing receipts in a group
            chat.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Link to="/register" className={`inline-flex items-center gap-2 ${BUTTON_PRIMARY}`}>
              Start splitting — it&rsquo;s free
              <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              See how it works
              <ArrowDown size={14} />
            </a>
          </div>
        </div>

        {/* Demo settlement card */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Apartment 4B</span>
            <span className="text-xs text-text-muted">3 people</span>
          </div>

          <div className="mt-5 space-y-3">
            {[
              { name: 'Alex', net: 42.5 },
              { name: 'Priya', net: -18.25 },
              { name: 'Sam', net: -24.25 },
            ].map((m) => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <DemoAvatar name={m.name} />
                  <span className="text-sm text-text-primary">{m.name}</span>
                </div>
                <span
                  className={`tabular-nums rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                    m.net > 0
                      ? 'bg-positive-bg text-positive-text'
                      : 'bg-negative-bg text-negative-text'
                  }`}
                >
                  {m.net > 0 ? '+' : '-'}
                  {formatCurrency(m.net)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-xs font-medium text-text-muted">Settle up</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <span className="font-medium">Priya</span>
                <ArrowRight size={13} className="text-text-muted" />
                <span className="font-medium">Alex</span>
                <span className="tabular-nums ml-auto font-semibold text-primary">
                  {formatCurrency(18.25)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <span className="font-medium">Sam</span>
                <ArrowRight size={13} className="text-text-muted" />
                <span className="font-medium">Alex</span>
                <span className="tabular-nums ml-auto font-semibold text-primary">
                  {formatCurrency(24.25)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
            How it works
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                className={`pt-6 ${i > 0 ? 'border-t border-border sm:border-t-0 sm:border-l sm:pl-8 sm:pt-0' : ''}`}
              >
                <span className="text-sm font-bold tabular-nums text-primary">{step.n}</span>
                <h3 className="mt-3 text-lg font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="max-w-lg text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
            Built for how groups actually spend
          </h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className={`flex gap-4 border-t border-border py-7 sm:py-8 ${
                    i % 2 === 1 ? 'sm:pl-10' : 'sm:pr-10'
                  } ${i < 2 ? 'sm:border-t' : ''}`}
                >
                  <Icon size={20} className="mt-0.5 shrink-0 text-primary" strokeWidth={1.75} />
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                      {f.body}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Social proof */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <p className="text-xl font-semibold leading-snug text-text-primary sm:text-2xl">
            &ldquo;We stopped arguing about who owes what the week we started using this.&rdquo;
          </p>
          <p className="mt-4 text-sm text-text-muted">— A Splitmate household, three months in</p>
          <p className="mx-auto mt-8 max-w-sm text-sm text-text-secondary">
            Every balance settles in the fewest payments possible — automatically, no matter
            how tangled the group&rsquo;s expenses get.
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-text-primary">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to stop doing the math?
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/60">
            Create your first group in under a minute. It&rsquo;s free, and it stays on your
            device.
          </p>
          <Link
            to="/register"
            className={`mt-8 inline-flex items-center gap-2 ${BUTTON_PRIMARY}`}
          >
            Start splitting — it&rsquo;s free
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <Logo size={48} />
          Splitmate
        </span>
        <span>Runs entirely in your browser.</span>
      </div>
    </div>
  )
}

export default Landing
