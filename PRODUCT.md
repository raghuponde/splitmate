# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Roommates and other shared-living groups who need to track and settle shared expenses (rent, utilities, groceries) on an ongoing basis.

## Product Purpose

Splitmate lets a group create a shared space, log expenses as they happen, and see a simplified "who pays whom" settlement so the group doesn't have to track running debts manually.

## Positioning

A simpler, lighter alternative to full-featured tools like Splitwise: no custom backend — accounts and data live in Supabase (Auth + Postgres with Row Level Security), so a group shares one source of truth across devices. Trades feature breadth for simplicity and speed.

## Operating Context

Runs as a client-side React app against Supabase. Members are added to a group either as registered users or as pending email invites; pending members are promoted to active membership automatically when they register. Expenses are split equally or manually and settled via a computed simplified-debt graph.

## Capabilities and Constraints

- No custom backend — Supabase (Auth + Postgres with Row Level Security) is the persistence layer; only `src/data/storage.js` talks to it.
- Data is scoped by RLS: users see only the groups they belong to, synced across devices.
- Expenses are soft-deleted, never removed, preserving history for past balance calculations.
- A group member is either "active" (registered) or "pending" (invited by email, not yet registered).

## Evidence on Hand

None (no real user content, testimonials, or case studies). Seeded test accounts exist for development/demo only (shubham@test.com, bob@test.com, rahul@test.com, eva@test.com), not real evidence.

## Product Principles

- Keep the surface honest: no promises beyond what the app does (no payments, no bank integration) — it tracks and settles, it does not move money.
- Favor simplicity and speed over feature completeness — this is the lightweight alternative, not a Splitwise clone.
- Preserve expense history accurately; settlement math must stay trustworthy since it's the core value proposition.
- Group membership should gracefully bridge active and pending (invited) users.
