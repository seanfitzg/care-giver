# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`care-giver` — multi-tenant care coordination app for people with complex medical needs.

**Stack:** Expo 55 (React Native + TypeScript) · Supabase (Postgres + Auth + Realtime + Edge Functions) · React Query · Expo Router

**Key constraints (non-negotiable):**

- Online-only — no offline support
- Invite-only onboarding — no self-registration
- Supabase RLS is the primary multi-tenancy isolation mechanism — must be airtight
- Consult `PRD.md` before implementing any feature

**UI**
Use the docs\care-giver-prototype.html wireframe as a guide to the UI.

## Architecture

```
app/               Expo Router screens
  (tabs)/          Bottom-tab navigator (Today, Feed, On Duty, Log)
contexts/          React Context providers (Auth, Duty)
lib/               Shared utilities (supabase client)
supabase/
  migrations/      Database migrations (run in order)
  seed.sql         Dev seed data
```

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

## Implementation Workflow

When the user says 'implement issue #N', start implementing immediately after a brief plan — do not first verify whether the issue is already done or run extensive exploration. Trust the user's request.

## Platform Conventions

- This is a Windows machine; default to PowerShell syntax (`$env:VAR="value"`), not bash `export`.
- For Expo Web, avoid `Alert.alert` for confirmations — it is silently swallowed. Use a Modal-based confirmation instead.
- For Android dev builds, never use `127.0.0.1` or `localhost` in `.env` — use the host machine's LAN IP.
