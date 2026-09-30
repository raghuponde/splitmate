# Splitmate

An expense-splitting app (Splitwise-style). Create groups, log shared expenses, and see a
simplified "who pays whom" settlement so nobody has to track running debts by hand.

## Features

- Email/password sign up and login (Supabase Auth); sessions persist across browser restarts
- Create groups and invite members by email — invitees who haven't registered yet appear as
  *pending* and are promoted to active members automatically when they sign up
- Log expenses with a category, split **equally** or **manually** (splits always sum exactly to the amount)
- Edit and delete expenses (soft-deleted, so history and past balances stay intact)
- Per-member net balances and simplified settlements
- **Reports** — expense history across all your groups by month and category, with a chart and CSV download
- **Profile** — change your display name and password, upload or remove a profile photo (email and join date are read-only)
- Account dropdown in the navbar (name, photo, chevron) with Profile, Reports and Sign out

## Tech stack

- React 18 + Vite 5
- React Router v7
- Tailwind CSS v4 (`@tailwindcss/vite`; theme tokens live in `src/index.css`)
- `lucide-react` icons
- Supabase (Auth + Postgres with Row Level Security + Storage) — no custom backend
- Plain JavaScript

## Getting started

```bash
npm install
```

Create `src/.env` with your Supabase project credentials:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

Then:

```bash
npm run dev       # start the dev server
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # run ESLint
```

### Database

The app expects these tables in Supabase: `profiles`, `groups`, `group_members`,
`group_pending_invites`, `expenses`, `expense_splits`, with RLS enabled, plus:

- `on_auth_user_created` trigger — creates the profile and promotes pending invites on registration
- `save_expense` function — atomic expense create/edit (a deferred trigger enforces that splits sum to the amount)
- `find_profile_by_email` function — user lookup for group invites
- `profiles.avatar_url` column and a public `avatars` Storage bucket (2 MB, JPG/PNG/WebP) with policies
  that let each user write only inside their own `<user-id>/` folder

### Test accounts

`shubham@test.com`, `bob@test.com`, `rahul@test.com`, `eva@test.com` — password `password` for all.

## Routes

| Path         | Page        | Auth      |
|--------------|-------------|-----------|
| `/`          | Landing     | public (redirects to `/dashboard` when logged in) |
| `/login`     | Login       | public    |
| `/register`  | Register    | public    |
| `/dashboard` | Dashboard   | protected |
| `/group/new` | CreateGroup | protected |
| `/group/:id` | GroupDetail | protected |
| `/reports`   | Reports     | protected |
| `/profile`   | Profile     | protected |

## Project structure

```
src/
  components/   Navbar, Logo, Avatar, ProtectedRoute, AddExpenseModal, MonthlyChart
  context/      AuthContext (only React context)
  data/         storage.js (all database access), supabaseClient.js
  pages/        Route-level components
  utils/        balance.js (split/debt math), format.js, styles.js, categories.js,
                monthlyReport.js, csvExport.js, useDocumentTitle.js
public/         logo.svg, default-avatar.png
specs/          Feature specs (reports, profile)
```

Conventions (see `CLAUDE.md` for details): only `storage.js` talks to the database, balance math
stays pure in `utils/balance.js`, money is always formatted with `formatCurrency`, and shared
Tailwind class strings live in `utils/styles.js`.
