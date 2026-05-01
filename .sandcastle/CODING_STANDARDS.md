# Coding Standards

## Style

### Naming
- `camelCase` for TypeScript variables, functions, and state (`isLoading`, `handleLogin`, `careRecipientId`)
- `PascalCase` for components, screens, layouts, and types (`LoginScreen`, `AuthProvider`, `UserRole`)
- `snake_case` for all database identifiers — table names, column names, enum values, RLS policy names
- Event handler functions: `handle<Action>` (e.g. `handleInvite`, `handleSetPassword`)
- Confirmation/destructive handlers: `confirm<Action>` (e.g. `confirmRevoke`)
- Boolean variables: `is`, `has`, or `can` prefix (e.g. `isAdmin`, `hasSession`, `canCheckOut`)
- React Query mutation variables: `<action>Mutation` (e.g. `inviteMutation`, `changeRoleMutation`)
- React Query keys: array with resource name + scoping ID (e.g. `['carers', careRecipientId]`)
- SQL function parameters: `p_<name>` prefix (e.g. `p_care_recipient_id`)

### TypeScript
- `strict: true` is enabled — no implicit `any`, no unchecked null access
- Define domain types at module level using `type`, not `interface` (e.g. `type UserRole = 'admin' | 'senior_carer' | 'carer'`)
- Context value shapes typed as `type <Name>Value = { ... }` at module level
- Do not create separate `types/` files for module-local types; co-locate them with the file that owns them
- Use generics on React Query hooks: `useQuery<ReturnType>`, `useMutation<void, Error, InputType>`

### Imports
- Use the `@/` path alias for all local imports — no relative `../` imports
- Import order: external libraries → `@tanstack/react-query` → Expo Router → Supabase → local `@/` imports
- Group and separate these three tiers with a blank line

### Exports
- Screens and layouts: `export default function <ScreenName>()`
- Providers and hooks: named export (`export function useAuth()`, `export function AuthProvider()`)
- Do not mix default and named exports from the same file unless one is the screen default and the other is a local type

### Styling
- Define styles with `StyleSheet.create()` at the bottom of the component file — never inline style objects
- Style property names in `camelCase` (e.g. `buttonDisabled`, `modalTitle`)
- Colours as hex strings (e.g. `#2563eb`) — no named colours or `rgba()` unless alpha is needed
- Shadow properties follow React Native conventions (`shadowColor`, `shadowOffset`, `elevation`)

---

## Testing

- Tests verify observable behaviour, not implementation details. A test should break only when the external outcome changes, not when internals are refactored.
- Tests use a real local Supabase instance (via `supabase start`) — never mock the database layer. The mock/prod divergence risk is too high for safety-critical care data.
- Priority modules for test coverage: Schedule Engine, Session Runner, Event Log, Bulk Catch-Up, Carer Duty.
- Each test should have a name that reads as a specification sentence (e.g. `"marks a carer on-duty when they have an open duty session"`).
- Do not test Supabase internals (RLS SQL) via the app layer — verify RLS behaviour through separate policy tests using the Supabase test helpers.

---

## Architecture

### Multi-tenancy
- Every query to a tenant-scoped table must be reachable via `care_recipient_id` so RLS can enforce isolation. Never write a query that would succeed across tenants if RLS were disabled.
- RLS helper functions (`has_care_recipient_role`, `is_admin_for`, `has_elevated_role`) are `SECURITY DEFINER` to avoid recursion — do not query `user_roles` directly inside a policy.

### State management
- Server state: React Query. Do not store server data in React Context or component state.
- Auth and duty status: React Context (`AuthContext`, `DutyContext`). These are the only global in-memory state stores.
- No Redux, Zustand, or additional state libraries.

### Event log
- The `event_log` table is append-only. Never issue `UPDATE` or `DELETE` against it. Corrections are written as new entries.
- Missed events are written by the scheduled Edge Function — not by client code.
- `bulk_confirmed = true` entries must have `occurred_at` set to the scheduled time, not wall-clock time.

### Supabase access
- Use the Supabase JS client for all database and auth operations.
- Prefer RPC calls (`supabase.rpc()`) for multi-step writes that must be atomic (e.g. `create_care_recipient`).
- Environment variables are prefixed `EXPO_PUBLIC_` and accessed via `process.env`.
- All new tables must have RLS enabled with explicit positive-grant policies — never rely on the default-deny alone.

### Push notifications
- Mobile: Expo Push Notification Service. Tokens stored in `push_tokens` with `token_type = 'expo'`.
- Web portal: Web Push API (service worker). Tokens stored in `push_tokens` with `token_type = 'web'`.
- The dispatch Edge Function must check `token_type` and route to the correct service — never send an Expo token to the Web Push endpoint or vice versa.

### Platforms
- The mobile app (Expo) and the web portal (Next.js) are separate codebases sharing the same Supabase backend.
- Do not add mobile-only assumptions to the data model or Edge Functions — both clients must be able to consume the same schema and RPCs.
- Shared logic (schedule calculations, validation, domain types) should live in a shared package rather than being duplicated.
