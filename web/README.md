# care-giver web

Next.js web app for the care-giver platform (App Router · TypeScript · Tailwind CSS · Supabase SSR).

## Prerequisites

- Node.js 18+
- The root-level Supabase stack running locally (`npm run supabase:start` from the repo root)

## Getting started

```bash
# 1. Copy and fill in environment variables
cp .env.example .env.local
# Paste the anon key and service-role key from `npm run supabase:start` output

# 2. Install dependencies (from this directory)
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running alongside the existing stack

From the **repo root** run Supabase first, then start the Next.js dev server in the `web/` directory:

```bash
# Terminal 1 — repo root
npm run supabase:start

# Terminal 2 — web/
cd web && npm run dev
```

Or use the root-level convenience script which starts both together:

```bash
npm run dev
```

## Available routes

| Route       | Purpose                     |
| ----------- | --------------------------- |
| `/`         | Home / landing              |
| `/login`    | Magic-link / password login |
| `/setup`    | First-run tenant setup      |
| `/schedule` | Scheduled care items        |
| `/log`      | Event log                   |
| `/duty`     | On-duty carer view          |
| `/admin`    | Admin panel                 |

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
```
