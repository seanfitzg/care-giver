# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`care-giver` — care coordination app for families of children with complex medical needs. Multi-tenant, invite-only, online-only.

**Stack**: React Native + Expo (TypeScript), Supabase (Postgres + Auth + Realtime + Edge Functions), React Query, Expo Push Notifications.

**Platforms**: Native mobile app (React Native + Expo) **and** a dedicated web portal. Architecture and data model decisions must work for both surfaces — avoid mobile-only assumptions.

**Roles**: Admin (always on-duty), Senior Carer (schedule management + check-in/out), Carer (record only + check-in/out).

**Key constraints**:
- Online-only; show a clear connectivity warning
- Invite-only onboarding — no self-registration; admin assigns role at invite time
- Notifications go to on-duty carers only
- Supabase RLS is the primary multi-tenancy isolation mechanism — must be reviewed before public release

See [PRD.md](PRD.md) for full product requirements.
