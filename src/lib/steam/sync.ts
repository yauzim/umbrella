import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  notInArray,
} from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  games,
  playtimeSnapshots,
  userAchievements,
  userGames,
  users,
} from "@/db/schema";
import {
  gameHeaderUrl,
  gameIconUrl,
  getGlobalAchievementPercentages,
  getOwnedGames,
  getPlayerAchievements,
  getPlayerSummary,
  getSchemaForGame,
  resolveHeaderImage,
  pooled,
} from "./api";

/**
 * Definitions rarely change, so a stale schema is cheap. Rarity drifts as
 * more people play, so it is refreshed more often. Both are shared across
 * all users — this is the main lever on our API budget.
 */
const SCHEMA_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RARITY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Steam tolerates parallel reads, but there is no reason to be rude. */
const CONCURRENCY = 4;

/**
 * Games scanned per request. A first-time sync of a 300-game library is
 * ~700 Steam calls; doing that in one HTTP request means a multi-minute
 * connection that loses everything if it drops. Batching keeps each
 * request short and commits progress as it goes, so a failure costs one
 * batch rather than the whole scan.
 */
const DEFAULT_BATCH = 25;

export interface SyncReport {
  steamId: string;
  private: boolean;
  gamesTotal: number;
  gamesScanned: number;
  gamesSkipped: number;
  /** Games still awaiting a scan. Non-zero means: call again. */
  remaining: number;
  achievementsUnlocked: number;
  perfectGames: number;
  durationMs: number;
  errors: string[];
}

/* ------------------------------------------------------------------ */
/* Profile + library                                                   */
/* ------------------------------------------------------------------ */

async function syncProfileAndLibrary(steamId: string) {
  const summary = await getPlayerSummary(steamId);
  if (!summary) throw new Error(`No Steam profile found for ${steamId}`);

  const owned = await getOwnedGames(steamId);
  const isPrivate = owned === null;
  const library = owned ?? [];
  const now = new Date();

  // Playtimes we already hold. A batched sync calls this once per batch, so
  // without comparing first, a ten-batch scan would write ten identical
  // snapshot rows per game and pollute the very history they exist to keep.
  const priorPlaytime = new Map(
    (
      await db
        .select({
          appid: userGames.appid,
          playtimeForever: userGames.playtimeForever,
        })
        .from(userGames)
        .where(eq(userGames.steamId, steamId))
    ).map((r) => [r.appid, r.playtimeForever]),
  );

  db.transaction((tx) => {
    tx.insert(users)
      .values({
        steamId,
        personaName: summary.personaname,
        avatarUrl: summary.avatarfull,
        profileUrl: summary.profileurl,
        profileIsPrivate: isPrivate,
        librarySyncedAt: now,
      })
      .onConflictDoUpdate({
        target: users.steamId,
        set: {
          // Refresh what Steam owns, but never clobber the user's own
          // customization (handle, bio, accent, theme).
          personaName: summary.personaname,
          avatarUrl: summary.avatarfull,
          profileUrl: summary.profileurl,
          profileIsPrivate: isPrivate,
          librarySyncedAt: now,
        },
      })
      .run();

    for (const g of library) {
      tx.insert(games)
        .values({
          appid: g.appid,
          name: g.name,
          iconUrl: gameIconUrl(g.appid, g.img_icon_url),
          headerUrl: gameHeaderUrl(g.appid),
        })
        .onConflictDoUpdate({
          target: games.appid,
          set: { name: g.name, iconUrl: gameIconUrl(g.appid, g.img_icon_url) },
        })
        .run();

      tx.insert(userGames)
        .values({
          steamId,
          appid: g.appid,
          playtimeForever: g.playtime_forever ?? 0,
          playtime2Weeks: g.playtime_2weeks ?? 0,
          lastPlayedAt: g.rtime_last_played
            ? new Date(g.rtime_last_played * 1000)
            : null,
        })
        .onConflictDoUpdate({
          target: [userGames.steamId, userGames.appid],
          set: {
            playtimeForever: g.playtime_forever ?? 0,
            playtime2Weeks: g.playtime_2weeks ?? 0,
            lastPlayedAt: g.rtime_last_played
              ? new Date(g.rtime_last_played * 1000)
              : null,
          },
        })
        .run();

      // Snapshot playtime so "unlocked at hour 62" becomes possible later.
      // Only for played games, and only when the number actually moved.
      const prior = priorPlaytime.get(g.appid);
      if (g.playtime_forever > 0 && prior !== g.playtime_forever) {
        tx.insert(playtimeSnapshots)
          .values({
            steamId,
            appid: g.appid,
            playtimeForever: g.playtime_forever,
            capturedAt: now,
          })
          .run();
      }
    }
  });

  await claimHandleFromVanityUrl(steamId, summary.profileurl);

  return { summary, library, isPrivate };
}

/**
 * Gives new profiles a readable URL.
 *
 * Steam users with a vanity URL already have a name they identify with
 * (steamcommunity.com/id/<name>), so we reuse it rather than leaving the
 * profile at a 17-digit SteamID. Only ever set once — after that the
 * handle is the user's to change.
 */
async function claimHandleFromVanityUrl(
  steamId: string,
  profileUrl: string | undefined,
): Promise<void> {
  if (!profileUrl) return;

  const vanity = /\/id\/([^/]+)\/?$/.exec(profileUrl)?.[1];
  if (!vanity) return; // profile is already /profiles/<id>, nothing to take

  const candidate = normalizeHandle(vanity);
  if (!candidate) return;

  const [existing] = await db
    .select({ handle: users.handle })
    .from(users)
    .where(eq(users.steamId, steamId))
    .limit(1);
  if (existing?.handle) return; // already has one; never overwrite

  const [taken] = await db
    .select({ steamId: users.steamId })
    .from(users)
    .where(eq(users.handle, candidate))
    .limit(1);
  if (taken) return; // someone got there first; they can pick one manually

  await db
    .update(users)
    .set({ handle: candidate })
    .where(eq(users.steamId, steamId));
}

/**
 * Handles must not be able to impersonate a SteamID, or `/u/<digits>`
 * would become ambiguous between a handle and an account number.
 */
export function normalizeHandle(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (cleaned.length < 3 || cleaned.length > 32) return null;
  if (/^\d+$/.test(cleaned)) return null;
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* Cover art                                                           */
/* ------------------------------------------------------------------ */

/**
 * Store lookups are rate limited far more tightly than the Web API, and
 * only a minority of games need one, so this stays deliberately small.
 * Anything not reached this batch is picked up by the next one.
 */
const ART_PER_BATCH = 12;
const ART_CONCURRENCY = 2;

/**
 * Fills in header art for games we have not checked yet. Results are
 * stored on the shared `games` row, so each game costs this once across
 * every user on the instance.
 */
async function resolveMissingArt(appids: number[]): Promise<void> {
  if (appids.length === 0) return;

  const unchecked = await db
    .select({ appid: games.appid })
    .from(games)
    .where(and(inArray(games.appid, appids), isNull(games.artCheckedAt)))
    .limit(ART_PER_BATCH);

  if (unchecked.length === 0) return;

  await pooled(unchecked, ART_CONCURRENCY, async ({ appid }) => {
    try {
      const url = await resolveHeaderImage(appid);
      db.update(games)
        .set({ headerUrl: url, artCheckedAt: new Date() })
        .where(eq(games.appid, appid))
        .run();
    } catch {
      // Leave artCheckedAt null so a later sync retries this game.
    }
  });
}

/* ------------------------------------------------------------------ */
/* Per-game achievement definitions (shared cache)                     */
/* ------------------------------------------------------------------ */

/**
 * Makes sure we hold current definitions and rarity for a game.
 * Returns a map of Steam's api_name to our internal achievement id, or
 * null when the game has no achievements at all.
 */
async function ensureGameSchema(
  appid: number,
): Promise<Map<string, number> | null> {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.appid, appid))
    .limit(1);

  const now = Date.now();
  const schemaFresh =
    game?.schemaSyncedAt && now - game.schemaSyncedAt.getTime() < SCHEMA_TTL_MS;
  const rarityFresh =
    game?.raritySyncedAt && now - game.raritySyncedAt.getTime() < RARITY_TTL_MS;

  // Already known to have none — do not spend a call re-confirming.
  if (game?.hasAchievements === false && schemaFresh) return null;

  if (schemaFresh && rarityFresh) {
    const rows = await db
      .select({ id: achievements.id, apiName: achievements.apiName })
      .from(achievements)
      .where(eq(achievements.appid, appid));
    return rows.length ? new Map(rows.map((r) => [r.apiName, r.id])) : null;
  }

  const [defs, rarity] = await Promise.all([
    schemaFresh ? Promise.resolve(null) : getSchemaForGame(appid),
    getGlobalAchievementPercentages(appid),
  ]);

  const stamp = new Date();

  if (defs !== null) {
    if (defs.length === 0) {
      db.update(games)
        .set({ hasAchievements: false, achievementCount: 0, schemaSyncedAt: stamp })
        .where(eq(games.appid, appid))
        .run();
      return null;
    }

    db.transaction((tx) => {
      for (const d of defs) {
        tx.insert(achievements)
          .values({
            appid,
            apiName: d.name,
            displayName: d.displayName || d.name,
            description: d.description ?? null,
            icon: d.icon ?? null,
            iconGray: d.icongray ?? null,
            hidden: d.hidden === 1,
            globalPercent: rarity.get(d.name) ?? null,
          })
          .onConflictDoUpdate({
            target: [achievements.appid, achievements.apiName],
            set: {
              displayName: d.displayName || d.name,
              description: d.description ?? null,
              icon: d.icon ?? null,
              iconGray: d.icongray ?? null,
              hidden: d.hidden === 1,
              globalPercent: rarity.get(d.name) ?? null,
            },
          })
          .run();
      }
      tx.update(games)
        .set({
          hasAchievements: true,
          achievementCount: defs.length,
          schemaSyncedAt: stamp,
          raritySyncedAt: stamp,
        })
        .where(eq(games.appid, appid))
        .run();
    });
  } else if (rarity.size > 0) {
    // Schema was fresh; we only needed to refresh the rarity numbers.
    db.transaction((tx) => {
      for (const [apiName, percent] of rarity) {
        tx.update(achievements)
          .set({ globalPercent: percent })
          .where(
            and(eq(achievements.appid, appid), eq(achievements.apiName, apiName)),
          )
          .run();
      }
      tx.update(games)
        .set({ raritySyncedAt: stamp })
        .where(eq(games.appid, appid))
        .run();
    });
  }

  const rows = await db
    .select({ id: achievements.id, apiName: achievements.apiName })
    .from(achievements)
    .where(eq(achievements.appid, appid));
  return rows.length ? new Map(rows.map((r) => [r.apiName, r.id])) : null;
}

/* ------------------------------------------------------------------ */
/* Per-game player progress                                            */
/* ------------------------------------------------------------------ */

async function syncGameAchievements(
  steamId: string,
  appid: number,
): Promise<{ unlocked: number; total: number; skipped: boolean }> {
  const idByApiName = await ensureGameSchema(appid);
  if (!idByApiName) {
    db.update(userGames)
      .set({ achievementsSyncedAt: new Date(), unlockedCount: 0 })
      .where(and(eq(userGames.steamId, steamId), eq(userGames.appid, appid)))
      .run();
    return { unlocked: 0, total: 0, skipped: true };
  }

  const result = await getPlayerAchievements(steamId, appid);
  if (result.status !== "ok") {
    return { unlocked: 0, total: idByApiName.size, skipped: true };
  }

  const earned = result.achievements.filter((a) => a.achieved === 1);
  const now = new Date();

  db.transaction((tx) => {
    for (const a of earned) {
      const achievementId = idByApiName.get(a.apiname);
      if (!achievementId) continue; // schema drift: achievement was removed

      tx.insert(userAchievements)
        .values({
          steamId,
          achievementId,
          appid,
          // unlocktime 0 means Steam has no record of when. Keep it null so
          // the timeline can say "date unknown" instead of claiming 1970.
          unlockedAt: a.unlocktime > 0 ? new Date(a.unlocktime * 1000) : null,
        })
        .onConflictDoUpdate({
          target: [userAchievements.steamId, userAchievements.achievementId],
          set: {
            unlockedAt:
              a.unlocktime > 0 ? new Date(a.unlocktime * 1000) : null,
          },
        })
        .run();
    }

    // Achievements can be revoked (family sharing, cheat resets, reworks).
    const keptIds = earned
      .map((a) => idByApiName.get(a.apiname))
      .filter((id): id is number => id !== undefined);
    if (keptIds.length > 0) {
      tx.delete(userAchievements)
        .where(
          and(
            eq(userAchievements.steamId, steamId),
            eq(userAchievements.appid, appid),
            notInArray(userAchievements.achievementId, keptIds),
          ),
        )
        .run();
    } else {
      tx.delete(userAchievements)
        .where(
          and(
            eq(userAchievements.steamId, steamId),
            eq(userAchievements.appid, appid),
          ),
        )
        .run();
    }

    tx.update(userGames)
      .set({ unlockedCount: earned.length, achievementsSyncedAt: now })
      .where(and(eq(userGames.steamId, steamId), eq(userGames.appid, appid)))
      .run();
  });

  return { unlocked: earned.length, total: idByApiName.size, skipped: false };
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

export async function syncUser(
  steamId: string,
  {
    force = false,
    batchSize = DEFAULT_BATCH,
  }: { force?: boolean; batchSize?: number } = {},
): Promise<SyncReport> {
  const started = Date.now();
  const errors: string[] = [];

  const { library, isPrivate } = await syncProfileAndLibrary(steamId);

  if (isPrivate) {
    return {
      steamId,
      private: true,
      gamesTotal: 0,
      gamesScanned: 0,
      gamesSkipped: 0,
      remaining: 0,
      achievementsUnlocked: 0,
      perfectGames: 0,
      durationMs: Date.now() - started,
      errors: ["Steam profile is private — game details cannot be read."],
    };
  }

  // An unplayed game cannot hold an unlocked achievement, so skipping them
  // turns a 900-game library into ~200 calls instead of 900.
  const candidates = library.filter((g) => (g.playtime_forever ?? 0) > 0);

  // A forced re-sync still needs to advance through its batches, so it uses
  // a short window rather than none at all. With no window, every batch
  // would re-scan the same first `batchSize` games and never finish.
  const freshnessMs = force ? 2 * 60 * 1000 : 6 * 60 * 60 * 1000;
  const staleCutoff = new Date(Date.now() - freshnessMs);
  const alreadyFresh = new Set(
    (
      await db
        .select({ appid: userGames.appid })
        .from(userGames)
        .where(
          and(
            eq(userGames.steamId, steamId),
            isNotNull(userGames.achievementsSyncedAt),
            gt(userGames.achievementsSyncedAt, staleCutoff),
          ),
        )
    ).map((r) => r.appid),
  );

  // Everything still owed a scan, of which we take one batch now. Progress
  // is durable because each game stamps its own achievementsSyncedAt, so
  // the next call naturally picks up where this one stopped.
  const pending = candidates.filter((g) => !alreadyFresh.has(g.appid));
  const toScan = pending.slice(0, batchSize);

  // Cover art is resolved against the whole library, not just this batch:
  // a fully-scanned library has nothing pending, and art would otherwise
  // never get filled in for it.
  const libraryAppids = library.map((g) => g.appid);
  await resolveMissingArt(libraryAppids);

  const [artLeft] = await db
    .select({ n: count() })
    .from(games)
    .where(and(inArray(games.appid, libraryAppids), isNull(games.artCheckedAt)));

  // Keep the client looping while either kind of work is outstanding.
  const remaining =
    Math.max(0, pending.length - toScan.length) + (artLeft?.n ?? 0);

  let unlockedTotal = 0;
  let perfect = 0;
  let scanned = 0;

  await pooled(toScan, CONCURRENCY, async (g) => {
    try {
      const r = await syncGameAchievements(steamId, g.appid);
      if (!r.skipped) {
        scanned++;
        unlockedTotal += r.unlocked;
        if (r.total > 0 && r.unlocked === r.total) perfect++;
      }
    } catch (err) {
      errors.push(
        `${g.name} (${g.appid}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  return {
    steamId,
    private: false,
    gamesTotal: library.length,
    gamesScanned: scanned,
    gamesSkipped: library.length - pending.length,
    remaining,
    achievementsUnlocked: unlockedTotal,
    perfectGames: perfect,
    durationMs: Date.now() - started,
    errors,
  };
}
