# Deployment notes

## Going live: `invite-carer` checklist

- **Update `INVITE_WEB_ORIGIN`** to the real production URL, full path included (not just the
  origin — the web admin's invite modal sends `${window.location.origin}/setup`):

  ```bash
  npx supabase secrets set INVITE_WEB_ORIGIN=https://<production-domain>/setup --project-ref <project-ref>
  ```

  It's currently set to the local dev value (`http://localhost:3000/setup`) — that alone will
  block invites once the web app is served from a real domain, since the allowlist check is an
  exact string match.

- **Redeploy `invite-carer` with `--no-verify-jwt`**, if it isn't already:

  ```bash
  npx supabase functions deploy invite-carer --project-ref <project-ref> --no-verify-jwt
  ```

  It does its own auth internally (checks the `Authorization` header, then `is_admin_for`), so
  the platform's default JWT gate isn't needed — and if it's ever left on, it blocks the
  browser's CORS preflight before the function's own code even runs, breaking invites from web
  with an opaque CORS error.
