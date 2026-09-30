# Splitmate

An expense-splitting app (Splitwise-style): create groups, log shared expenses, and see
simplified settlements ("who pays whom"). Data and auth live in Supabase (Postgres + Row Level Security); there is no custom backend.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build
- `npm run lint` — ESLint

No test runner is configured yet.

## Tech stack

- React 18 + Vite 5
- React Router v7 (`react-router-dom`) for routing
- Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js` — theme tokens are CSS
  custom properties in `src/index.css`)
- `lucide-react` for icons
- Supabase (`@supabase/supabase-js`): Auth + Postgres + Storage. Env vars in `src/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
- Plain JS (no TypeScript)

## Folder structure

```
src/
  components/     Reusable UI: Navbar (account dropdown), Logo, Avatar,
                   ProtectedRoute, AddExpenseModal, MonthlyChart
  context/        AuthContext — the only React context in the app
  data/           storage.js (Supabase data layer) + supabaseClient.js
  pages/          Route-level components: Landing, Login, Register, Dashboard,
                   CreateGroup, GroupDetail, Reports, Profile
  utils/          Pure helpers: balance.js (split/debt math), format.js, styles.js
                   (shared Tailwind class strings), categories.js,
                   monthlyReport.js (report aggregation), csvExport.js,
                   useDocumentTitle.js (tab title hook)
  App.jsx         Route table
  main.jsx        Entry point
  index.css       Tailwind import + theme tokens (CSS custom properties)
  .env            Supabase env vars (git-ignored)
public/logo.svg   App logo
public/default-avatar.png  Fallback profile photo
specs/            Feature specs (reports.md, profile.md)
PRODUCT.md        Product context (users, purpose, principles) for design skills
.mcp.json         Project-scoped Supabase MCP server config
```

## Data models

Defined and documented at the top of `src/data/storage.js`. All records are plain objects
with a UUID id, stored in Supabase tables (`profiles`, `groups`, `group_members`, `group_pending_invites`, `expenses`, `expense_splits`); `storage.js` maps rows to these shapes
(`toGroup` / `toExpense`). Every exported function is async and throws on Supabase errors.
Row Level Security limits reads/writes to groups the signed-in user belongs to.

```
User    { id, name, email }   // profile row; passwords are handled by Supabase Auth
                              // // AuthContext user: { id, name, email, avatarUrl, createdAt }. `profiles.avatar_url` holds the
                              // path in the public `avatars` Storage bucket (`<uid>/avatar.<ext>`, 2 MB, JPG/PNG/WebP)

Group   { id, name, memberIds: [userId], pendingEmails: [email], createdBy: userId, createdAt }

Expense { id, groupId, description, amount, paidBy: userId,
          splits: [{ userId, amount }], splitType: 'equal' | 'manual',
          date, createdAt, isDeleted, createdBy: userId, category: string }
```

Notes:
- `splits` must always sum to `amount`. `computeEqualSplits` (in `utils/balance.js`) handles
  integer-cent rounding so equal splits sum exactly.
- Expenses are **soft-deleted** (`isDeleted: true`), never removed. `editExpense` works by
  soft-deleting the original and creating a new expense, preserving the original `createdBy`
  and keeping history intact for past balance calculations.
- A group member is either "active" (`memberIds`, a real `userId`) or "pending"
  (`pendingEmails`, invited by email but not yet registered). The `on_auth_user_created`
  Postgres trigger creates the profile and promotes pending emails to active membership on registration.
- Expense create/edit goes through the `save_expense` Postgres function (atomic; splits must sum to
  `amount`, enforced by a deferred trigger). `find_profile_by_email` looks up users for group invites.

## Routes (`src/App.jsx`)

| Path          | Page         | Auth |
|---------------|--------------|------|
| `/`           | Landing      | public (redirects to `/dashboard` if logged in) |
| `/login`      | Login        | public |
| `/register`   | Register     | public |
| `/dashboard`  | Dashboard    | protected |
| `/group/new`  | CreateGroup  | protected |
| `/group/:id`  | GroupDetail  | protected |
| `/reports`    | Reports      | protected |
| `/profile`    | Profile      | protected |

Reports: cross-group expense history by month/category with CSV export (read-only, see
`specs/reports.md`). Profile: edit name, change password, upload/remove photo; email and join date
are display-only (see `specs/profile.md`).

`ProtectedRoute` wraps protected pages and redirects to `/login` when there's no user.

## Key conventions

- **Only `src/data/storage.js` queries the database** (client in `src/data/supabaseClient.js`). Pages/components call its exported
  async functions (`getGroups`, `createGroup`, `simplifyDebts`, etc.) — never `supabase.from(...)` elsewhere. Auth goes through `AuthContext` only. No localStorage in app code (supabase-js keeps its own session there).
- **Balance math is pure and separate from storage.** `src/utils/balance.js` has no
  database access (`computeEqualSplits`, `calculateNetBalances`, `simplifyDebts`);
  `storage.js` wraps these for group-scoped convenience. Keep new split/debt logic in
  `balance.js` so it stays unit-testable.
- **No global state library.** `AuthContext` is the only context. Pages read from `storage.js`
  directly and re-render via a local `refreshKey` counter bumped after a mutation (see
  `GroupDetail.jsx`) rather than lifting state up.
- **Styling:** shared Tailwind class strings live in `src/utils/styles.js`
  (`BUTTON_PRIMARY`, `BUTTON_SECONDARY`, `BUTTON_DANGER`, `INPUT`, `CARD`, `BADGE_*`,
  `balancePillClasses`). Reuse these instead of inlining new button/input/card styles.
  Color tokens are CSS variables in `src/index.css` (`--color-primary`, `--color-bg`,
  `--color-text-primary`, positive/negative/neutral/badge variants, etc.) — use the
  matching Tailwind utilities (`text-primary`, `bg-surface`, `text-positive-text`, ...)
  rather than hardcoding hex values.
- **Profile / account:** a name change updates both `profiles.name` and auth metadata
  (`AuthContext.updateName`). Password changes verify the current password by re-signing in, then
  `updateUser` (`AuthContext.changePassword`). Photos go through `storage.js`
  (`uploadAvatar` / `removeAvatar`); call `refreshUser()` after any profile mutation so the navbar
  updates. Email is never editable. Render user photos with `Avatar`, never a bare `<img>`.
- **Navbar:** signed-in users get a single account dropdown (name + avatar + chevron) holding
  Profile, Reports and Sign out. Add new account-level links there, not as separate navbar items.
- **Currency:** always format money with `formatCurrency` from `utils/format.js`.
- **Money epsilon:** balance/settlement comparisons use `SPLIT_EPSILON` (0.005) from
  `utils/balance.js` to avoid floating-point false positives — reuse it, don't compare
  amounts with `=== 0` or `> 0` directly.
- **Layout:** pages are centered in a `max-w-[680px]` column with `px-4` padding; auth pages
  use `max-w-sm`. Match this when adding pages.
- **Test accounts:** seeded in the Supabase project as real Auth users
  (shubham@test.com / bob@test.com / rahul@test.com / eva@test.com, password `password`
  for all).
