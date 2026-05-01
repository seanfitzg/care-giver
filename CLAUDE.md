# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`care-giver` — multi-tenant care coordination app for children with complex medical needs.

**Two clients, one backend:**
- **Mobile app** — React Native + Expo (TypeScript), Expo Router, React Query. Primary tool for on-duty carers on iPhone, Android, and iPad.
- **Web app** — Next.js 15 (App Router, TypeScript, Tailwind CSS) in `web/`. Desktop-first; better suited to admin tasks. Uses `@supabase/ssr` + PKCE flow.
- **Backend** — Supabase (Postgres + Auth + Realtime + Edge Functions). Same schema, RLS policies, and Edge Functions serve both clients. No backend-only changes should favour one client over the other.

**Key constraints (non-negotiable):**
- Online-only — no offline support
- Invite-only onboarding — no self-registration
- Supabase RLS is the primary multi-tenancy isolation mechanism — must be airtight
- Any feature decision must work for both the mobile app and the web portal — consult `PRD.md` before implementing

## Architecture

```
app/               Expo Router screens (mobile)
  (auth)/          Login + post-invite setup
  (tabs)/          Bottom-tab navigator (Today, Feed, On Duty, Log)
  admin/           Carer management (admin-only)
contexts/          React Context providers (Auth, Duty)
lib/               Shared utilities (supabase client)
web/               Next.js web portal (desktop-first)
supabase/
  functions/       Edge Functions (serve both clients)
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
- Mobile env vars are prefixed `EXPO_PUBLIC_`; web env vars use `NEXT_PUBLIC_` — both point at the same Supabase project
- All new Supabase tables must have RLS enabled with explicit policies — never rely on the default-deny being enough; add positive grants too
- Append-only event log — never update or delete event records
- Invite links must support both the native deep-link scheme (`caregiver://`) and an `https://` URL for the web portal — use the `redirect_to` parameter on the `invite-carer` Edge Function
- Do not introduce a shared component library between mobile and web; copy types as needed
