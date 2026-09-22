# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`care-giver` — multi-tenant care coordination app for people with complex medical needs.

**Stack:** Expo 57 (React Native + TypeScript) · Supabase (Postgres + Auth + Realtime + Edge Functions) · React Query · Expo Router

**Key constraints (non-negotiable):**

- Online-only — no offline support
- Invite-only for joining an _existing_ Care Recipient — Roles are never self-service. Account creation itself, and starting a _brand-new_ Care Recipient, are self-serve (Sign Up).
- Supabase RLS is the primary multi-tenancy isolation mechanism — must be airtight
- Consult `PRD.md` before implementing any feature

**UI**
Use the docs\care-giver-prototype.html wireframe as a guide to the UI.

## Architecture

```
app/               Expo Router screens
  (tabs)/          Bottom-tab navigator (Today, Schedule, Log)
contexts/          React Context providers (Auth)
lib/               Shared utilities (supabase client)
supabase/
  migrations/      Database migrations (run in order)
  seed.sql         Dev seed data
```

## Environment Variables

- This is a monorepo with BOTH a Next.js web app (`web/`) and an Expo app (root). Web app env vars MUST be prefixed `NEXT_PUBLIC_`; Expo app vars MUST be prefixed `EXPO_PUBLIC_`. Never copy a var between apps without renaming the prefix.

## Local dev

```bash
npm run dev              # start Supabase + Expo together (preferred)
# or manually:
npm run supabase:start   # start Docker-based Supabase
cp .env.example .env     # fill in anon key from supabase:start output
npm start                # start Expo dev server
```

## Commands

```bash
npm run type-check       # tsc --noEmit
npm run lint             # eslint
npm run supabase:stop    # stop Supabase
npx supabase db reset    # reset DB + re-run migrations + seed
npx supabase db diff     # generate migration from schema diff
```

## Conventions

- Path alias `@/` maps to the project root (configured in tsconfig.json)
- Environment variables are prefixed `EXPO_PUBLIC_` so they're available client-side
- All new Supabase tables must have RLS enabled with explicit policies — never rely on the default-deny being enough; add positive grants too
- Append-only event log — never update or delete event records
- Always format any .js or .tsx files with the prettier formatter.

## Documentation Workflow

When asked for recommendations, research, ideas, or design discussions, save the output to a markdown file in `/docs/` by default rather than responding inline. Confirm the filename with the user only if ambiguous.

## Supabase CLI Conventions

- Use `npx supabase db query` (not the deprecated `db execute`).
- Always include `--linked` flag for remote operations (seed, push, query).
- Run `npx supabase db push` BEFORE seeding when new migrations exist.
- For edge function tests, invoke Deno directly — the `supabase functions test` subcommand has been removed.
- Creating a migration file is NOT done. After writing any file in `supabase/migrations/`, run `supabase link --project-ref <ref>` (if not linked) then `supabase db push`, and confirm the columns exist before opening a PR.

## Implementation Workflow

When the user says 'implement issue #N', start implementing immediately after a brief plan — do not first verify whether the issue is already done or run extensive exploration. Trust the user's request.

Before starting, check whether issue #N carries the `epic` label (see Issue Conventions below). If it does, stop and ask the user which sub-issue to implement instead — an epic is a parent spec meant to be split into sub-issues, not implemented directly as one ticket.

Before writing any code: `git fetch origin master` and pull the latest, then create a new branch off it for the ticket (e.g. `feat/issue-108-short-description`). Do not commit ticket work onto whatever branch happens to be currently checked out — it may be a stale or already-merged branch left over from prior work.

## Platform Conventions

- The user works across multiple machines (Windows and Mac) and this changes over time — do NOT assume a fixed OS. Check the `Platform:` field in the environment info at the start of each session and use matching shell syntax: PowerShell (`$env:VAR="value"`) on Windows (`win32`), bash/zsh `export` on Mac/Linux (`darwin`/`linux`).
- For Expo Web, avoid `Alert.alert` for confirmations — it is silently swallowed. Use a Modal-based confirmation instead.
- For Android dev builds, never use `127.0.0.1` or `localhost` in `.env` — use the host machine's LAN IP.

## Git & PR Workflow

- Use `gh pr create --title "..." --body-file /tmp/pr-body.md`. Never pass `--body` and `--body-file` together (it hangs on stdin). Verify `gh auth status` before starting any issue work.

## Issue Conventions

- A parent issue that has sub-issues tracking pieces of it (e.g. a feature split into per-platform tickets) is an **epic** — apply the `epic` label to it via `gh issue edit <N> --add-label epic` when creating or identifying one. This makes it stand out in the issue list at a glance, separate from its title's `feat:`/`fix:`/`chore:` prefix, which stays unchanged.

## Definition of Done

- Every feature must pass: `npm run type-check`, `npm run lint`, `npm run build`. State explicitly in the PR body which verification steps were NOT possible (e.g. local Supabase, browser testing) rather than implying full verification.
