# Profile

Status: implemented

## Summary

A protected page where the signed-in user views their account details, edits their display
name, changes their password, and uploads a profile photo. Email and join date are always
display-only. There is no custom backend: everything goes through Supabase Auth, Postgres
(RLS) and Supabase Storage, following the conventions in `CLAUDE.md`.

## Route and navigation

| Path       | Page    | Auth      |
|------------|---------|-----------|
| `/profile` | Profile | protected |

- New file `src/pages/Profile.jsx`, registered in `src/App.jsx` inside `ProtectedRoute`.
- Entry point: the user's avatar + name in `Navbar` becomes a `Link` to `/profile` (see
  "Navbar behavior").
- Call `useDocumentTitle('Profile')` (existing helper, as other pages do).
- Layout column: `max-w-[680px]`, `px-4` (matches other pages).

## Data model changes

### 1. `profiles.avatar_url` (new column)

```sql
alter table public.profiles add column avatar_url text;  -- null = no photo
```

Stores the **storage object path** (e.g. `<userId>/avatar.jpg`), not a full URL, so the
bucket can be made private later without a data migration. `null` means "no photo".

### 2. Join date

Read-only, from `auth.users.created_at`, exposed to the client as `authUser.created_at`.
No new column. Extend `toAppUser` in `AuthContext.jsx` (see "App user shape").

### 3. Storage bucket `avatars`

- Public-read bucket (avatars are shown to group members; the URL is not secret).
- Max object size: 2 MB. Allowed MIME types set on the bucket: `image/jpeg`, `image/png`, `image/webp`.
- Object path is always `<auth.uid()>/avatar.<ext>` — one file per user, overwritten
  (`upsert: true`) on replace. Because the extension can change, delete the old object when the
  extension differs.
- RLS policies on `storage.objects` for bucket `avatars`:
  - `select`: anyone (public bucket).
  - `insert` / `update` / `delete`: only when `(storage.foldername(name))[1] = auth.uid()::text`.

All DDL/policies ship as one Supabase migration (`apply_migration`).

### 4. Name storage — two places, keep in sync

Today the name lives in **both** `auth.users.raw_user_meta_data.name` (read by
`AuthContext.toAppUser`) and `profiles.name` (read by `getUsers` / `getGroupMembers`, so other
members see it). A name change must update **both**, otherwise group pages and the navbar
disagree. Order: update `profiles` first (RLS: `id = auth.uid()` update policy — add it if it
does not exist), then `supabase.auth.updateUser({ data: { name } })`. If the second call
fails, attempt to revert `profiles.name` to the old value and show the error.

## App user shape

`AuthContext` user becomes:

```
{ id, name, email, avatarUrl: string | null, createdAt: string /* ISO */ }
```

- `createdAt` = `authUser.created_at`.
- `avatarUrl` = public URL derived from `profiles.avatar_url`. It is **not** in the auth
  session, so `AuthContext` fetches it once after a session is established (via a new
  `getMyProfile()` in `storage.js`) and stores it in the same context state. `loading` stays
  `true` until this resolves so the navbar does not flash default avatar → photo.
- Expose a new context method `refreshUser()` (re-reads auth user + profile, updates state)
  and use it after every successful mutation on this page. The context's existing
  `onAuthStateChange` also fires `USER_UPDATED` after `updateUser`, but do not rely on it for
  the avatar; call `refreshUser()` explicitly.
- Cache-bust the avatar URL with `?v=<updated timestamp>` so a replaced image shows
  immediately despite CDN/browser caching.

## `storage.js` additions

Per convention, only `storage.js` talks to Supabase data/storage; the password change and name
metadata update go through `AuthContext` (Auth is AuthContext-only).

| Function | Where | Behavior |
|----------|-------|----------|
| `getMyProfile()` | storage.js | Returns `{ id, name, email, avatarUrl }` for the signed-in user. |
| `updateProfileName(name)` | storage.js | Updates `profiles.name` for the current user. Throws on error. |
| `uploadAvatar(file)` | storage.js | Validates again (type, size), uploads to `avatars/<uid>/avatar.<ext>` with `upsert`, sets `profiles.avatar_url`, removes stale object if ext changed. Returns the public URL. |
| `removeAvatar()` | storage.js | Deletes the object and sets `profiles.avatar_url = null`. |
| `updateName(name)` | AuthContext | Calls `updateProfileName`, then `supabase.auth.updateUser({ data: { name } })`, then `refreshUser()`. |
| `changePassword(current, next)` | AuthContext | See "Changing password". |

All throw `Error` with a user-presentable `message` (map raw Supabase messages where noted below).

## Page layout

Top to bottom, each block a `CARD`, vertical gap `space-y-4`:

1. **Header** — `<h1>` "Profile".
2. **Account card** — photo, name (display), email, joined date. Contains the photo controls
   and the read-only fields.
3. **Name card** — "Display name" form.
4. **Password card** — "Change password" form.

(Photo lives in the Account card; name editing in its own card so each form has its own
Save button, its own error area and its own success message. Forms are independent: saving
one never submits or resets another.)

### Account card — what is shown

| Item | Editable | Source | Display |
|------|----------|--------|---------|
| Profile photo | Yes (upload / remove) | `profiles.avatar_url` | 96×96 circle |
| Name | Yes (in Name card) | `user.name` | Shown as heading in this card, updates live after save |
| Email | **No, never** | `user.email` | Plain text, with a `Lock` icon and helper text "Your email can't be changed." Not an `<input>`; if rendered as one it must be `readOnly` + `aria-readonly`, styled muted, and excluded from all submit payloads. |
| Joined | No | `user.createdAt` | "Member since 14 March 2025" — format with `toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })` |

Do not add any email edit affordance (no pencil, no "change email" link).

## Profile photo

### Accepted files

- Types: **JPEG, PNG, WebP** (`image/jpeg`, `image/png`, `image/webp`). GIF, SVG, HEIC etc. rejected (SVG can carry script).
- Max size: **2 MB** (2 × 1024 × 1024 bytes).
- File input: `<input type="file" accept="image/jpeg,image/png,image/webp" hidden>` triggered by the button. Validate the MIME type from `file.type` **and** that the extension is `.jpg/.jpeg/.png/.webp` — the `accept` attribute is only a hint.
- No minimum dimensions. Display is center-cropped with `object-cover` in a circle; no client-side cropping UI in v1.

### Flow

1. User clicks **"Upload photo"** (or **"Change photo"** if one exists) → OS file picker.
2. Client validates immediately. On failure, show the error inline under the photo and do not upload.
3. On valid file: show the chosen image as an optimistic local preview (`URL.createObjectURL`, revoke on completion), disable both photo buttons, show a spinner overlay on the avatar.
4. Call `uploadAvatar(file)`. On success: `refreshUser()`, clear preview, show "Photo updated" (polite live region, auto-clears after ~4 s).
5. On failure: revert the preview to the previous image/fallback and show the error.
6. **"Remove photo"** (`BUTTON_SECONDARY`, only when a photo exists): confirm with an inline "Remove your photo? [Remove] [Cancel]" (no modal), then `removeAvatar()` → `refreshUser()`.

Reset the file input's value after every attempt so selecting the same file again re-triggers `change`.

### Storage

Supabase Storage bucket `avatars`, path `<userId>/avatar.<ext>`, path saved in
`profiles.avatar_url`. See "Data model changes".

### Fallback when no photo

When `avatarUrl` is null, show the static default avatar `/default-avatar.png` (file lives in
`public/`, 640×640 grey silhouette), in the same circle with `object-cover`. No initials.
If an uploaded image fails to load (`onError`), swap to `/default-avatar.png` rather than
showing a broken image. The same fallback is used in the navbar.

Put this in a shared `src/components/Avatar.jsx` (`{ name, src, size }`) used by Navbar and
Profile; `src` falls back to `/default-avatar.png`. Give the `<img>` `alt=""` when a visible
name is adjacent (decorative), otherwise `alt={name}`.

### Photo errors

| Condition | Message (shown under the avatar, `text-negative-text`, `role="alert"`) |
|-----------|---------|
| Wrong type | "Use a JPG, PNG or WebP image." |
| Over 2 MB | "That image is too large. Maximum size is 2 MB." |
| Not signed in / session expired | "Your session has expired. Sign in again." |
| Upload/network/storage failure | "Couldn't upload your photo. Please try again." |
| Remove failure | "Couldn't remove your photo. Please try again." |

## Editing name

- Field: "Display name", text input (`INPUT`), pre-filled with `user.name`, `autoComplete="name"`, `maxLength={50}`.
- Button: **"Save name"** (`BUTTON_PRIMARY`). Disabled while saving, or when the trimmed value equals the current name (nothing to save), or when invalid. A "Cancel"/reset control is not needed; navigating away discards edits.
- Enter key in the field submits the form.
- Rules (validate on submit, and clear the error as soon as the user edits again; also validate on blur once touched):
  - Trim leading/trailing whitespace; collapse nothing else.
  - Required: 1–50 characters after trimming.
  - No control characters. Any Unicode letters/digits/punctuation allowed (names are not restricted to ASCII).
- On save: button label → "Saving…", call `updateName(trimmed)`. Success: `refreshUser()` runs, input re-syncs to the saved value, show "Name updated" inline next to the button (polite live region, clears after ~4 s).
- Uniqueness is **not** enforced (two people may share a name).

### Name errors

| Condition | Message |
|-----------|---------|
| Empty / whitespace only | "Enter your name." |
| > 50 chars | "Name must be 50 characters or fewer." |
| Control characters | "Name contains invalid characters." |
| Save failure (network, Supabase) | "Couldn't save your name. Please try again." |
| Partial failure (profile updated, auth metadata failed) | Revert profile, then the generic save-failure message. |

Show field errors below the input with `aria-describedby` + `aria-invalid="true"`; show
request-level errors in a `role="alert"` region above the button.

## Changing password

Fields (all `type="password"`, each with a show/hide toggle button using `Eye`/`EyeOff`, toggle has `aria-label` and `aria-pressed`):

1. **Current password** — `autoComplete="current-password"`
2. **New password** — `autoComplete="new-password"`
3. **Confirm new password** — `autoComplete="new-password"`

Button: **"Update password"** (`BUTTON_PRIMARY`), disabled while saving.

### Validation rules

| Field | Rule |
|-------|------|
| Current | Required (non-empty). Not trimmed (spaces may be part of a password). |
| New | Minimum **8** characters. Maximum **72** characters (bcrypt limit). Must differ from the current password. No composition rules (no forced symbols/uppercase) — length only. Not trimmed. |
| Confirm | Must exactly equal New. |

Note: the seeded test accounts use password `password` (8 chars), which passes the minimum.
Also confirm the Supabase project's password policy (Auth settings) is not stricter than
these rules; if it is, either match it here or map its error (below).

Client validation runs on submit and again on blur once touched; a field's error clears when
it is edited. Confirm-mismatch is also re-checked when New changes.

### Submit flow

Supabase's `updateUser({ password })` does not verify the old password, so verification is done manually inside `AuthContext.changePassword(current, next)`:

1. `supabase.auth.signInWithPassword({ email: user.email, password: current })`. If it fails with `status === 400` (invalid credentials) → throw `Error('Current password is incorrect')` and stop. Do not update anything.
2. `supabase.auth.updateUser({ password: next })`. Map Supabase errors (see table).
3. On success: clear all three fields, reset visibility toggles to hidden, show "Password updated" (polite live region, ~4 s), move focus to the success message. Keep the user signed in (the session from step 1 stays valid). Do not sign out other sessions in v1.

Because step 1 refreshes the session, `onAuthStateChange` will fire; this must not reset the page's form state (form state is local to the component and independent of `user` identity — do not key the form on the `user` object).

Rate limiting: after a failed current-password check, do not implement extra client-side lockouts; rely on Supabase's built-in rate limits and surface their error.

### Password errors

| Condition | Where | Message |
|-----------|-------|---------|
| Current empty | under Current | "Enter your current password." |
| Current wrong | under Current | "Current password is incorrect." |
| New empty | under New | "Enter a new password." |
| New < 8 | under New | "Password must be at least 8 characters." |
| New > 72 | under New | "Password must be 72 characters or fewer." |
| New same as current | under New | "New password must be different from your current password." |
| Confirm empty | under Confirm | "Confirm your new password." |
| Confirm mismatch | under Confirm | "Passwords don't match." |
| Supabase "weak password" / policy rejection | under New | Show Supabase's message if user-presentable, else "That password is too weak. Try a longer one." |
| Rate limited (HTTP 429) | form-level | "Too many attempts. Wait a minute and try again." |
| Network / other | form-level | "Couldn't update your password. Please try again." |

The current-password field is cleared and refocused after a "current password is incorrect"
failure; the New/Confirm fields keep their values.

## Navbar behavior

`Navbar` currently renders `user.name` as plain text. Change to:

- A `Link to="/profile"` containing `<Avatar size={32} name={user.name} src={user.avatarUrl} />` and the name (`text-sm text-text-secondary`, hover `text-text-primary`). Keep "Reports" and "Sign out" as-is. Mark the link `aria-current="page"` (visually: `text-text-primary`) when on `/profile`.
- Navbar reads from `AuthContext` only, so it updates **automatically and without a page reload** when `refreshUser()` runs after a save: the name text and the avatar (photo ↔ default avatar) both re-render from the new context value. No prop drilling, no events, no local copy of the name.
- Because `AuthContext` also updates via `onAuthStateChange` (`USER_UPDATED`) — including when the change is made in **another tab** — the navbar stays consistent across tabs for the name. The avatar in another tab updates on its next `refreshUser()`/session event; this is acceptable.
- Truncation: name is `max-w-[10rem] truncate` on mobile (see below); full name available via `title`.
- Other pages that show the current user's own name (group member lists, expense payer names) fetch names from `profiles` through `storage.js`; they show the new name on their next load. No cross-page live sync is required.

## Mobile vs desktop layout

Breakpoint: Tailwind `sm` (640 px).

**Desktop (≥ `sm`)**
- Column `max-w-[680px]`, centered.
- Account card: photo on the left (96 px), details to its right (name as heading, email, joined date). Photo buttons ("Upload/Change photo", "Remove photo") sit in a row beneath the avatar or beside the details, left-aligned.
- Name form: input and "Save name" button on **one row** (`flex gap-3`, input `flex-1`).
- Password form: fields stacked full width; "Update password" button left-aligned, auto width.
- Success/error text appears inline beside the button when it fits, otherwise below.

**Mobile (< `sm`)**
- Same column with `px-4`; cards go full-width of the column.
- Account card stacks vertically, centered: avatar (96 px) on top, photo buttons below it stacked full-width (each ≥ 44 px tall tap target), then name, email, and joined date centered.
- Name form: input on its own row, "Save name" full-width below it.
- Password form: fields stacked; "Update password" full-width.
- Error and success messages always render below the field/button, full width, never truncated; long emails wrap with `break-all`.
- Inputs use `text-base` (16 px) on mobile to prevent iOS zoom-on-focus.
- Navbar: avatar (32 px) + truncated name link; if space is tight, hide the name text below `sm` and show only the avatar (keep `aria-label="Profile"`). "Sign out" stays visible.

## Loading, empty and session states

- While `AuthContext.loading` is true, `ProtectedRoute` already gates the page. The page itself
  needs no separate skeleton because `user` is populated before render.
- If `refreshUser()` fails after a successful mutation, the change has still been saved: show
  "Saved, but couldn't refresh. Reload the page." (non-blocking).
- If the session expires mid-action (401 / "JWT expired"), show the session-expired message and
  let `ProtectedRoute` redirect to `/login` when the auth state clears.
- Double-submit protection: each form has its own `saving` state; buttons disabled while in flight.

## Accessibility

- One `<h1>`; each card has an `<h2>`.
- Every input has a visible `<label>` bound with `htmlFor`.
- Field errors linked via `aria-describedby`, `aria-invalid`; on a failed submit, focus moves to the first invalid field.
- Success and request errors announced through `aria-live` (`polite` for success, `assertive`/`role="alert"` for errors).
- Avatar buttons have visible text (not icon-only). Show/hide password toggles have accessible names.
- Color is never the only error signal (message text + `aria-invalid`).

## Styling

Reuse `src/utils/styles.js`: `CARD`, `INPUT`, `BUTTON_PRIMARY`, `BUTTON_SECONDARY`. Use
theme utilities (`text-negative-text`, `text-positive-text`, `text-text-muted`, `bg-primary/10`,
`border-border`), not hex values. Icons from `lucide-react`: `Lock`, `Eye`, `EyeOff`, `Camera`,
`User`. If a danger-styled inline error box is needed, reuse whatever pattern `Login.jsx` uses
for its error message so the look is consistent.

## Files touched

| File | Change |
|------|--------|
| `src/pages/Profile.jsx` | New page |
| `src/components/Avatar.jsx` | New shared component (photo or default avatar) |
| `public/default-avatar.png` | Fallback image (already added) |
| `src/App.jsx` | Add `/profile` protected route |
| `src/components/Navbar.jsx` | Avatar + name link to `/profile` |
| `src/context/AuthContext.jsx` | Add `avatarUrl`, `createdAt`, `refreshUser`, `updateName`, `changePassword` |
| `src/data/storage.js` | `getMyProfile`, `updateProfileName`, `uploadAvatar`, `removeAvatar` |
| Supabase migration | `profiles.avatar_url`, `avatars` bucket + storage policies, `profiles` self-update RLS policy (if missing) |
| `CLAUDE.md` | Update routes table, folder structure, and data-model notes |

## Out of scope (v1)

- Changing email, or any email-related UI
- Deleting the account
- Image cropping/zoom, drag-and-drop upload
- Signing out other sessions after a password change
- "Forgot password" / reset by email (separate flow on `/login`)
- Live avatar sync across other users' open pages

## Acceptance checklist

- [ ] `/profile` redirects to `/login` when signed out.
- [ ] Email and join date are displayed, cannot be edited, and never sent in any request.
- [ ] Name edit persists to both `profiles.name` and auth metadata; navbar updates with no reload; group member lists show it on next load.
- [ ] Name validation: empty, whitespace-only, 51 chars, and control chars each show their message; 50 chars saves.
- [ ] Password: wrong current password rejected without changing anything; 7-char, 73-char, same-as-current and mismatched-confirm each show their message; success clears the form and keeps the user signed in; can then sign out and in with the new password.
- [ ] Photo: JPG/PNG/WebP ≤ 2 MB uploads and appears on Profile and navbar; GIF and a 3 MB JPG are rejected with the right message; replacing works (no stale cached image); removing returns to the default avatar.
- [ ] A user cannot write to another user's `avatars/<otherId>/…` path (verify RLS).
- [ ] Layout checked at 375 px and 1280 px widths; no horizontal scroll; tap targets ≥ 44 px on mobile.
- [ ] `npm run lint` and `npm run build` pass.
