# care-giver

Care coordination app for people with complex medical needs. Multi-tenant, real-time, invite-only.

**Stack:** Expo (React Native + TypeScript) · Supabase · React Query

---

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Supabase)
- [Expo Go](https://expo.dev/go) on your phone, or an iOS/Android simulator
- Expo CLI: `npm install -g expo-cli` (optional — `npx expo` works without it)

---

## Local development

### 1. Clone and install

```bash
git clone https://github.com/seanfitzg/care-giver.git
cd care-giver
npm install --legacy-peer-deps
```

### 2. Start local Supabase

Docker Desktop must be running first.

```bash
npm run supabase:start
```

On first run this pulls the Supabase Docker images (~1 GB). Once running it prints your local API URL and anon key:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
Studio: http://127.0.0.1:54323
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and paste in the `anon key` printed above:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Run the app

```bash
npm start
```

- Press `i` for iOS simulator, `a` for Android emulator, `w` for web, or scan the QR code with Expo Go.

### Stop Supabase

```bash
npm run supabase:stop
```

---

## Project structure

```
app/
  _layout.tsx          # Root layout — QueryClientProvider + Auth + Duty providers
  (tabs)/
    _layout.tsx        # Bottom-tab navigator
    index.tsx          # Today screen
    feed.tsx           # Feeding session screen
    on-duty.tsx        # Duty management screen
    log.tsx            # Care history screen
contexts/
  AuthContext.tsx      # Auth state (session, user, signOut)
  DutyContext.tsx      # On-duty state (checkIn, checkOut)
lib/
  supabase.ts          # Supabase client
supabase/
  config.toml          # Local Supabase configuration
  migrations/          # Database migrations (added in issue #2)
  seed.sql             # Development seed data
```

---

## Useful commands

| Command | Description |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run type-check` | TypeScript type-check (no emit) |
| `npm run lint` | ESLint |
| `npm run supabase:start` | Start local Supabase stack |
| `npm run supabase:stop` | Stop local Supabase stack |
| `npx supabase db reset` | Reset DB and re-run migrations + seed |
| `npx supabase db diff` | Diff schema changes into a new migration |

---

## Supabase Studio

When the local stack is running, the Studio is at [http://127.0.0.1:54323](http://127.0.0.1:54323). Use it to inspect tables, run queries, and manage auth users during development.
