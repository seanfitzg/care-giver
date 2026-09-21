# Migrating Off Supabase: SQL Server vs. Self-Hosted Postgres

## Context

This app currently runs on Supabase (managed Postgres + Auth + Realtime + Edge Functions), and RLS is the primary multi-tenancy isolation mechanism (see `CLAUDE.md`). This doc compares two options if the team ever wants to migrate off Supabase's managed platform, evaluated against that constraint. It does not recommend migrating now — it's a reference for if/when that question comes up.

Related: [`decouple-from-supabase.md`](./decouple-from-supabase.md) covers an in-app repository/service-layer abstraction that would make _any_ backend swap easier, independent of which target is chosen.

## Option A: Microsoft SQL Server

**Server-side functions.** SQL Server supports T-SQL stored procedures and functions (`CREATE PROCEDURE`, `CREATE FUNCTION`), conceptually similar to the Postgres functions this app already uses (e.g. `create_care_recipient`, called via `supabase.rpc(...)`).

**Row-Level Security.** SQL Server has had RLS since 2016, via **security policies** and **predicate functions** — inline table-valued functions that decide whether a row is visible/writable, attached with `CREATE SECURITY POLICY ... ADD FILTER PREDICATE ...`.

**The catch.** SQL Server's RLS filters on session context (`SESSION_CONTEXT()` / `USER_NAME()`), not a client-supplied JWT the way Supabase's `auth.uid()` works. Expo can't connect to SQL Server directly (no driver, and exposing a DB straight to mobile clients is a non-starter), so a new API layer (Node/Express, .NET, etc.) would sit between the app and the database. That API becomes responsible for authenticating the request and then explicitly setting the session context before every query. Miss that wiring on one endpoint and the tenant-isolation guarantee silently breaks — a sharper foot-gun than Supabase's model, where the JWT flows automatically with every request.

**Net effect:** this is a full rewrite of the backend — new database engine, new query layer, new API tier, new auth system, RLS reimplemented from scratch with a weaker safety net.

## Option B: Self-hosted / different managed Postgres

Staying on Postgres (RDS, Cloud SQL, Neon, self-hosted, etc.) while dropping the Supabase platform is a meaningfully smaller lift:

- **RLS policies and Postgres functions carry over unchanged.** Everything in `supabase/migrations/` is plain Postgres SQL — `auth.uid()`-style RLS predicates work identically on any Postgres instance, since they're not a Supabase-specific feature.
- **What has to be rebuilt** is the managed _platform_ around the database, not the data model or authorization logic:
  - **Auth** — GoTrue (what Supabase Auth runs) is open-source and self-hostable, or swap to another provider.
  - **Auto-generated REST API** — PostgREST is also open-source and self-hostable (it's literally what Supabase uses).
  - **Realtime** — would need Supabase's open-source Realtime server or a custom solution.
  - **Storage** — would need a replacement (S3-compatible storage + a metadata layer).
  - **Edge Functions** — the two functions in `supabase/functions/` (Deno-based) would need a new runtime: Deno Deploy, Cloudflare Workers, or similar.

**Net effect:** "replace the managed platform," not "rewrite the backend." The core data model, RLS policies, and authorization logic survive as-is.

## Comparison

|                                     | SQL Server                                                         | Self-hosted Postgres                                 |
| ----------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| RLS available                       | Yes (security policies, since 2016)                                | Yes (native, unchanged from current setup)           |
| Existing migrations reusable        | No — full rewrite                                                  | Yes — unchanged                                      |
| RLS identity wiring                 | Manual per-request session context in a new API tier; easy to miss | Automatic via JWT, same as today                     |
| Auth replacement needed             | Yes (e.g. Azure AD B2C)                                            | Yes, but GoTrue (Supabase's own) is a drop-in option |
| API layer needed                    | Yes, must be built                                                 | Yes, but PostgREST is a drop-in option               |
| Realtime / Storage / Edge Functions | All rebuilt from scratch                                           | Open-source Supabase components can be self-hosted   |
| Overall scope                       | Full backend rewrite                                               | Replace managed platform, keep data/auth model       |

## Recommendation

If migrating off Supabase is ever necessary, staying on Postgres is the clearly lower-risk path — it preserves the existing RLS-based multi-tenancy guarantee (the app's stated non-negotiable isolation mechanism) with far less surface area for a security regression, versus SQL Server which requires re-deriving that guarantee inside a hand-built API layer.
