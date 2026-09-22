# Umbrella

An achievement profile worth showing off. Every existing tracker is a
spreadsheet with a forum attached; this one is a shelf — rarest unlocks up
front, 100% runs as cover art, and one timeline of everything you've finished.

Steam today. PSN and RetroAchievements are designed to merge into the same
timeline later.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

- **`STEAM_API_KEY`** — from https://steamcommunity.com/dev/apikey
  (needs a Steam account that isn't limited). Budget is ~100k calls/day.
- **`SESSION_SECRET`** — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Then create the database and start:

```bash
npx drizzle-kit migrate
npm run dev
```

Sign in at http://localhost:3000. The first sync runs automatically and
scans your library; a large one takes a minute or two.

> Your Steam **Game details** privacy must be set to Public, or Steam
> returns nothing and the profile will say so.

### Demo data

To work on the UI without a Steam key:

```bash
node scripts/seed-demo.mjs   # then visit /u/demo
```

Game names and appids are real so the CDN art loads; the unlocks and rarity
figures are invented.

## How it stays inside the API budget

A naive tracker spends one call per owned game per user. Three things avoid
that:

1. **Game schemas and rarity are cached globally**, not per user — they're
   identical for everyone, so the second person to own a game costs nothing.
2. **Unplayed games are skipped.** You can't have unlocked something in a
   game you never launched, which cuts a 900-game library to roughly 200 calls.
3. **Recently-synced games are skipped** for 6 hours unless `?force=1`.

## Platform notes

| Platform | Status |
| --- | --- |
| Steam | Official API, free key, unlock timestamps and global rarity. |
| RetroAchievements | Official API, free. Next up — keep the `hardcore` flag distinct. |
| PlayStation | No official API; `psn-api` works via a user-supplied NPSSO token. |
| Xbox | No official API; OpenXBL is the usual third-party route. |
| Epic | **Not possible today.** EOS Web API only lets developers query their own titles; there is no consumer endpoint for a user's achievements. |

## Known gap

Steam exposes total playtime and unlock time, but never *playtime at the
moment of unlock* — so "she got this at hour 62" can't be computed
retroactively. `playtime_snapshots` records the data from day one so the
feature becomes possible later.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle + SQLite ·
Steam OpenID 2.0 with `jose` sessions.

Swap the SQLite URL for Postgres in `drizzle.config.ts` and `src/db/index.ts`
when deploying.
