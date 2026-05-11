# Google Login Implementation Plan

## Context

The app currently uses **email/password only**, within an **invite-only** onboarding model: an admin invites a carer by email via the `invite-carer` Edge Function, Supabase creates an `auth.users` record, the carer clicks the email link to set a password, then logs in.

Google login would allow invited carers to sign in with their Google account instead of (or in addition to) setting a password. The invite-only constraint must be preserved: signing in with Google should only succeed if the user's Google email has already been invited (i.e. has a `user_roles` entry). Arbitrary Google accounts must not gain access.

---

## What needs to change

### 1. Google OAuth App (one-time setup, outside the codebase)

Create a Google Cloud project and OAuth 2.0 credentials:

- Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
- Create an **OAuth 2.0 Client ID** (type: Web application)
- Add authorized redirect URIs:
  - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback` (production)
  - `http://localhost:54321/auth/v1/callback` (local Supabase)
- Note the **Client ID** and **Client Secret**

---

### 2. Supabase config.toml — enable Google provider

**File:** `supabase/config.toml` (~line 317)

Change the `[auth.external.google]` block:

```toml
[auth.external.google]
enabled = true
client_id = "env(AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(AUTH_EXTERNAL_GOOGLE_SECRET)"
redirect_uri = ""  # leave blank; Supabase uses its own callback URL
```

Add to `.env` (and `.env.example`):

```
AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<your-client-id>
AUTH_EXTERNAL_GOOGLE_SECRET=<your-client-secret>
```

For **production**: enable Google in the Supabase Dashboard under Authentication → Providers → Google.

---

### 3. New npm dependencies

```bash
npx expo install expo-auth-session expo-web-browser expo-crypto
```

- `expo-web-browser` — opens the Google OAuth page in a browser tab
- `expo-auth-session` — handles PKCE flow and redirect
- `expo-crypto` — required by `expo-auth-session` for PKCE code verifier

The `caregiver` deep link scheme is already configured in `app.json`, so no change needed there.

---

### 4. Deep link callback handling

The OAuth flow redirects back to the app via a deep link like:

```
caregiver://auth/callback#access_token=...&refresh_token=...
```

`app/(auth)/setup.tsx` already parses a near-identical URL fragment (lines 26–44). The `onAuthStateChange` listener in `AuthContext` fires automatically when the OAuth session lands, so **no new callback screen is needed** — the AuthGate routing logic in `_layout.tsx` handles navigation from there.

---

### 5. Login screen — add Google button

**File:** `app/(auth)/login.tsx`

Add a "Sign in with Google" button below the existing email/password form:

```tsx
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession(); // must be at module top level

async function handleGoogleSignIn() {
  const redirectTo = makeRedirectUri({ scheme: 'caregiver', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true, // required on native
    },
  });
  if (data?.url) {
    await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  }
}
```

The `onAuthStateChange` listener in `AuthContext` picks up the session when the browser redirects back.

---

### 6. Enforce invite-only after Google sign-in

**File:** `app/_layout.tsx` (AuthGate component)

`loadUserData()` in `AuthContext` already queries `user_roles` and returns null if the user has no role — so an uninvited Google account can't reach the tabs. However, they'd currently fall through to the `create-recipient` screen, which is misleading.

Add an explicit branch in AuthGate to route uninvited Google users to a clear error screen:

```tsx
if (session && !careRecipientId && !isNewInvite) {
  return <Redirect href="/(auth)/not-invited" />;
}
```

**New file:** `app/(auth)/not-invited.tsx` — a minimal screen with a message like "Your account hasn't been invited to any care team. Please ask your admin to invite you."

---

### 7. Invite flow compatibility — critical

The `invite-carer` Edge Function creates users via `adminClient.auth.admin.inviteUserByEmail()`. When the invited user later signs in with Google using the **same email address**, Supabase will by default create a **second** `auth.users` record — breaking the role lookup.

**Fix:** Enable **"Link accounts using OAuth email"** in the Supabase Dashboard under Authentication → Settings. This merges the Google sign-in with the existing invited user record, preserving the `user_roles` assignment.

---

## Files to modify

| File                         | Change                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `supabase/config.toml`       | Enable `[auth.external.google]` block                                  |
| `.env` / `.env.example`      | Add `AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `AUTH_EXTERNAL_GOOGLE_SECRET` |
| `package.json`               | Add `expo-auth-session`, `expo-web-browser`, `expo-crypto`             |
| `app/(auth)/login.tsx`       | Add Google sign-in button and handler                                  |
| `app/_layout.tsx`            | Add "not invited" redirect branch in AuthGate                          |
| `app/(auth)/not-invited.tsx` | New screen for uninvited Google users                                  |

No changes needed to:

- `contexts/AuthContext.tsx` — `loadUserData()` and `onAuthStateChange` handle Google sessions identically to email sessions
- `supabase/migrations/` — `user_roles` already ties identity to access; no schema changes needed
- `supabase/functions/invite-carer/` — invite still creates the user record by email

---

## Verification

1. `npx supabase db reset` and `npm run dev`
2. Enable Google provider in local config with real credentials
3. Tap "Sign in with Google" → browser opens Google consent → redirects back to app
4. Verify an invited user (with a `user_roles` entry) lands on the tabs screen
5. Verify an uninvited Google account hits the "not invited" screen
6. Verify existing email/password login still works
7. Test the invite flow end-to-end: invite a Gmail address → user signs in with Google → role is matched (requires "link accounts by email" enabled in Supabase)
