# Plan: Decouple from Supabase via Repository/Service Layer

## Context

The app currently imports the Supabase client directly in 5 files with zero abstraction. This makes it hard to swap the backend (e.g., local SQLite, a different BaaS) without touching every screen. The fix is a standard **Repository/Service pattern**: define TypeScript interfaces for each concern, create Supabase implementations, and inject them via React Context.

The app is early-stage (most tab screens are placeholders), so now is the best time to add this layer before more screens are built.

**Security caveat:** Supabase's RLS policies enforce data isolation at the Postgres level — all queries are automatically scoped to the authenticated user. A future non-Supabase backend (e.g., local SQLite) would lose this guarantee. Each interface documents the authorization contract that a compliant implementation must honour in application code.

---

## New File Structure

```
services/
  types.ts                              ← Domain types (AppSession, AppUser, UserRole, CarerRow, UserData)
  interfaces.ts                         ← TypeScript interfaces + Services bundle type
  ServicesContext.tsx                   ← React context + ServicesProvider + useServices() hook
  supabase/
    SupabaseAuthService.ts
    SupabaseUserRoleRepository.ts
    SupabaseCareRecipientRepository.ts
    SupabaseCarerInviteService.ts
    index.ts                            ← createSupabaseServices(client) factory
```

---

## Domain Types — `services/types.ts`

```typescript
export type UserRole = 'admin' | 'senior_carer' | 'carer';

export type AppSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  userEmail: string | null;
};

export type AppUser = { id: string; email: string | null };

export type UserData = {
  role: UserRole;
  careRecipientId: string;
  careRecipientName: string;
};

export type CarerRow = {
  id: string;
  userId: string;
  role: UserRole | 'admin';
  email: string | null;
};
```

These replace `Session` and `User` from `@supabase/supabase-js` in the public API surface. `AuthContextValue` will use `AppSession | null` and `AppUser | null` instead of the Supabase types. No external consumers read raw Supabase fields beyond what these types expose.

---

## Interfaces — `services/interfaces.ts`

```typescript
export type Unsubscribe = () => void;

export type Services = {
  authService: AuthService;
  userRoleRepository: UserRoleRepository;
  careRecipientRepository: CareRecipientRepository;
  carerInviteService: CarerInviteService;
};

export interface AuthService {
  getSession(): Promise<AppSession | null>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  onAuthStateChange(callback: (session: AppSession | null) => void): Unsubscribe;
}

// SECURITY CONTRACT: reads must be scoped to the authenticated user's care recipients;
// writes (updateRole, revokeAccess) must be admin-only.
export interface UserRoleRepository {
  getUserData(userId: string): Promise<UserData | null>;
  listCarersWithEmails(careRecipientId: string): Promise<CarerRow[]>;
  updateRole(userId: string, careRecipientId: string, role: UserRole): Promise<void>;
  revokeAccess(userId: string, careRecipientId: string): Promise<void>;
}

// SECURITY CONTRACT: createCareRecipient must atomically create the record and
// assign the calling user as admin (no partial state).
export interface CareRecipientRepository {
  createCareRecipient(name: string, dateOfBirth: string): Promise<string>;
}

// SECURITY CONTRACT: inviteCarer must verify the calling user is admin for
// the care recipient before sending the invite.
export interface CarerInviteService {
  inviteCarer(
    email: string,
    role: Exclude<UserRole, 'admin'>,
    careRecipientId: string,
  ): Promise<void>;
}
```

---

## Supabase Implementations

Each class takes a `SupabaseClient` constructor argument and implements the corresponding interface. Key implementation notes:

**`SupabaseAuthService`**

- `toAppSession()` helper maps Supabase `Session` → `AppSession`
- `onAuthStateChange` returns `() => subscription.unsubscribe()`
- All error paths `throw new Error(error.message)` — callers get plain `Error`, not `AuthError`

**`SupabaseUserRoleRepository`**

- `getUserData` maps the existing query in `AuthContext.tsx:28-39` (currently `fetchUserData`)
- `listCarersWithEmails` wraps the existing `supabase.rpc('get_carers_with_emails', ...)` call
- `updateRole` / `revokeAccess` wrap the existing `.from('user_roles').update/delete()` calls

**`SupabaseCareRecipientRepository`**

- `createCareRecipient` wraps `supabase.rpc('create_care_recipient', { p_name, p_date_of_birth })`

**`SupabaseCarerInviteService`**

- `inviteCarer` wraps `supabase.functions.invoke('invite-carer', ...)` and internally fetches the session token — consumers no longer need to read `session.access_token`

**`services/supabase/index.ts`**

```typescript
export function createSupabaseServices(client: SupabaseClient): Services {
  return {
    authService: new SupabaseAuthService(client),
    userRoleRepository: new SupabaseUserRoleRepository(client),
    careRecipientRepository: new SupabaseCareRecipientRepository(client),
    carerInviteService: new SupabaseCarerInviteService(client),
  };
}
```

---

## Dependency Injection — `services/ServicesContext.tsx`

```typescript
const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: React.ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}
```

---

## Files to Modify

### `app/_layout.tsx`

- Import `supabase` from `@/lib/supabase`, `ServicesProvider`, and `createSupabaseServices`
- Create services at module level (same pattern as `queryClient`): `const services = createSupabaseServices(supabase)`
- Wrap the tree: `ServicesProvider` goes inside `QueryClientProvider`, outside `AuthProvider`

```tsx
const services = createSupabaseServices(supabase);

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>
        <AuthProvider>
          ...
```

### `contexts/AuthContext.tsx`

- Remove `import { Session, User } from '@supabase/supabase-js'` and `import { supabase } from '@/lib/supabase'`
- Remove module-level `fetchUserData` function
- Import `AppSession`, `AppUser`, `UserRole`, `UserData` from `@/services/types`
- Add `const { authService, userRoleRepository } = useServices()` at top of `AuthProvider`
- Replace `supabase.auth.getSession()` → `authService.getSession()`
- Replace `supabase.auth.onAuthStateChange()` subscription → `authService.onAuthStateChange()`
- Replace `fetchUserData(session.user.id)` → `userRoleRepository.getUserData(session.userId)`
- Replace `supabase.auth.signOut()` → `authService.signOut()`
- Change `session` state type to `AppSession | null`; derive `user` as `session ? { id: session.userId, email: session.userEmail } : null`

### `app/(auth)/login.tsx`

- Remove `supabase` import; add `useServices()`
- Replace `supabase.auth.signInWithPassword(...)` → `authService.signInWithPassword(email, password)`

### `app/(auth)/setup.tsx`

- Remove `supabase` import; add `useServices()`
- Replace `supabase.auth.setSession(...)` → `authService.setSessionFromTokens(accessToken, refreshToken)`
- Replace `supabase.auth.updateUser({ password })` → `authService.updatePassword(password)`

### `app/(auth)/create-care-recipient.tsx`

- Remove `supabase` import; add `useServices()`
- Replace `supabase.rpc('create_care_recipient', ...)` → `careRecipientRepository.createCareRecipient(name, dob)`

### `app/admin/index.tsx`

- Remove `supabase` import; add `useServices()`
- Replace `fetchCarers` → `userRoleRepository.listCarersWithEmails(careRecipientId)`
- Replace `inviteMutation` body → `carerInviteService.inviteCarer(email, role, careRecipientId!)`
- Replace `changeRoleMutation` body → `userRoleRepository.updateRole(userId, careRecipientId!, role)`
- Replace `revokeMutation` body → `userRoleRepository.revokeAccess(userId, careRecipientId!)`
- Replace local `CarerRow` type with imported one from `@/services/types`; update all `carer.user_id` → `carer.userId` (TypeScript will catch these)
- Remove session read inside `inviteMutation` (the service handles the token internally)
- Local `UserRole` type definition can be removed; import from `@/services/types`

---

## Verification

1. `npm run type-check` — TypeScript must pass with zero errors; the `session.user_id` → `carer.userId` rename and the `Session`/`User` type changes will surface any missed consumers
2. `npm run lint` — no new lint errors
3. Manual flow: start Supabase + Expo (`npm run dev`), log in, navigate to admin screen, invite a carer, change role, revoke — all should work exactly as before
4. `npx supabase db reset` + re-test — confirms no migration changes were accidentally introduced (this PR should be schema-neutral)
