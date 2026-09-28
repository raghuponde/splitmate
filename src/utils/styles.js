export const BUTTON_PRIMARY =
  'cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50'

export const BUTTON_SECONDARY =
  'cursor-pointer rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg'

export const BUTTON_DANGER =
  'cursor-pointer rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700'

export const INPUT =
  'w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none transition-shadow focus:border-primary focus:ring-[3px] focus:ring-primary/12'

export const CARD = 'rounded-xl border border-border bg-surface p-5'

export const BADGE_ACTIVE =
  'rounded-full bg-badge-active-bg px-2 py-0.5 text-xs font-medium text-badge-active-text'

export const BADGE_PENDING =
  'rounded-full bg-badge-pending-bg px-2 py-0.5 text-xs font-medium text-badge-pending-text'

export function balancePillClasses(net, eps = 0.005) {
  if (net > eps) return 'rounded-full bg-positive-bg px-3 py-1 text-[13px] font-semibold text-positive-text'
  if (net < -eps) return 'rounded-full bg-negative-bg px-3 py-1 text-[13px] font-semibold text-negative-text'
  return 'rounded-full bg-neutral-bg px-3 py-1 text-[13px] font-semibold text-neutral-text'
}
