# Umbrella

An achievement profile worth showing off. Every existing tracker is a
spreadsheet with a forum attached; this one is a shelf — rarest unlocks up
front, 100% runs as cover art, and one timeline of everything you've finished.

Steam today. PSN and RetroAchievements are designed to merge into the same
timeline later.

## Setup

```bash
npm install
git config core.hooksPath .githooks   # enable the secret-blocking hook
cp .env.example .env.local
```

That hook is per-clone and not automatic — Git will not run hooks from a
fresh clone until you point it at them. It refuses any commit containing an
env file, a database file, a private key, or token-shaped content (including
the 32-char uppercase hex of a Steam Web API key).

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

Remove it with `node scripts/seed-demo.mjs --clean`.

Fixtures live in a reserved appid range (≥ 900000001) with invented game
names. An earlier version seeded against real appids, which corrupted real
game pages twice over: invented achievements appeared beside genuine ones,
and because the seed stamped `schema_synced_at`, the real sync treated
those games as cached and never fetched their true Steam schemas. Keep
fixtures in their own id range.

## Earned decoration

Steam's Points Shop sells avatar frames and profile backgrounds. Here the
same richness is earned rather than bought, which is the whole premise:

- **Backgrounds** use `library_hero.jpg`, the 1920×620 art Valve produces
  to sit behind a page, with the game's transparent `logo.png` composited
  over it. Both come from a game in your own library. A stretched 460×215
  `header.jpg` was what made the old profile look flat.
- **Avatar frames** are determined by the rarest achievement you hold —
  Verdant under 50%, Azure under 20%, Amethyst under 5%, Gilded under 1%,
  Mythic under 0.5%. The top three rotate. The ring is a claim anyone can
  verify by scrolling to your rarest unlocks.

Nothing is purchasable and nothing is uploadable.

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

## Planned

Captured direction, not yet built:

Nothing outstanding from the original notes — ratings, reviews, lists and
leaderboards all shipped. Natural next steps: a second platform
(RetroAchievements), and an activity feed of what people you follow have
been unlocking.

Built so far beyond the profile:

- **Game pages** (`/game/<appid>`) — half-star ratings, written reviews
  with a spoiler blur, every achievement rarest-first with your unlock
  state, and who else here has played it.
- **Completion context** — median hours to 100%, median hours played and
  average completion, computed from this instance's own players. Median
  rather than mean, because one idler at 900 hours would make a 20-hour
  game look like a career. Says so explicitly when the sample is tiny.
- **Lists** — Backlog and Currently hunting are created on demand; custom
  lists can be made from any game page. Reorderable when ranked, per-item
  notes, public or private.
- **Leaderboards** (`/leaderboard`) — completions, rare unlocks and total
  achievements, scoped to world, region or Steam friends, with a
  jump-to-my-position control.

Region depends on `loccountrycode`, which Steam only returns for a public
profile that has a country set — so when it is missing the page says how to
fix it rather than filing people under "Unknown". Friends come from
`GetFriendList`, which needs a public friend list.

Two constraints these should respect, because they are what the product is
for:

1. Personalization stays sourced from games and earned achievements. No
   uploads.
2. Setup should cost a minute, not an evening. More expressive than
   Letterboxd, but not a design tool.

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
