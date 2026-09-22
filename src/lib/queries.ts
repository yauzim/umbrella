import { and, asc, count, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  games,
  lists,
  listItems,
  userAchievements,
  userGames,
  users,
} from "@/db/schema";

export type ProfileUser = typeof users.$inferSelect;

/** Profiles resolve by chosen handle first, then by raw SteamID64. */
export async function getProfileUser(
  idOrHandle: string,
): Promise<ProfileUser | null> {
  const [byHandle] = await db
    .select()
    .from(users)
    .where(eq(users.handle, idOrHandle))
    .limit(1);
  if (byHandle) return byHandle;

  const [bySteamId] = await db
    .select()
    .from(users)
    .where(eq(users.steamId, idOrHandle))
    .limit(1);
  return bySteamId ?? null;
}

export interface ProfileStats {
  unlocked: number;
  /** Achievements that exist across the games they have played. */
  available: number;
  perfectGames: number;
  gamesWithAchievements: number;
  totalPlaytimeMinutes: number;
  /** Mean global rarity of everything they own. Lower = harder profile. */
  averageRarity: number | null;
  rarestPercent: number | null;
}

export async function getProfileStats(steamId: string): Promise<ProfileStats> {
  const [unlockedRow] = await db
    .select({
      unlocked: count(),
      avgRarity: sql<number | null>`avg(${achievements.globalPercent})`,
      rarest: sql<number | null>`min(${achievements.globalPercent})`,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .where(eq(userAchievements.steamId, steamId));

  const [libraryRow] = await db
    .select({
      gamesWithAchievements: count(),
      available: sql<number>`coalesce(sum(${games.achievementCount}), 0)`,
    })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(
      and(
        eq(userGames.steamId, steamId),
        gt(games.achievementCount, 0),
        gt(userGames.playtimeForever, 0),
      ),
    );

  const [playRow] = await db
    .select({
      minutes: sql<number>`coalesce(sum(${userGames.playtimeForever}), 0)`,
    })
    .from(userGames)
    .where(eq(userGames.steamId, steamId));

  const [perfectRow] = await db
    .select({ n: count() })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(
      and(
        eq(userGames.steamId, steamId),
        gt(games.achievementCount, 0),
        sql`${userGames.unlockedCount} >= ${games.achievementCount}`,
      ),
    );

  return {
    unlocked: unlockedRow?.unlocked ?? 0,
    available: Number(libraryRow?.available ?? 0),
    perfectGames: perfectRow?.n ?? 0,
    gamesWithAchievements: libraryRow?.gamesWithAchievements ?? 0,
    totalPlaytimeMinutes: Number(playRow?.minutes ?? 0),
    averageRarity: unlockedRow?.avgRarity ?? null,
    rarestPercent: unlockedRow?.rarest ?? null,
  };
}

export interface UnlockRow {
  achievementId: number;
  displayName: string;
  description: string | null;
  icon: string | null;
  globalPercent: number | null;
  unlockedAt: Date | null;
  appid: number;
  gameName: string;
  gameHeaderUrl: string | null;
}

const unlockSelection = {
  achievementId: achievements.id,
  displayName: achievements.displayName,
  description: achievements.description,
  icon: achievements.icon,
  globalPercent: achievements.globalPercent,
  unlockedAt: userAchievements.unlockedAt,
  appid: userAchievements.appid,
  gameName: games.name,
  gameHeaderUrl: games.headerUrl,
};

/** The showcase: hardest things this person has ever done. */
export async function getRarestUnlocks(
  steamId: string,
  limit = 6,
): Promise<UnlockRow[]> {
  return db
    .select(unlockSelection)
    .from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .innerJoin(games, eq(games.appid, userAchievements.appid))
    .where(
      and(
        eq(userAchievements.steamId, steamId),
        isNotNull(achievements.globalPercent),
      ),
    )
    .orderBy(asc(achievements.globalPercent))
    .limit(limit);
}

/**
 * The unified timeline. Cross-platform today means Steam only, but the
 * shape is already platform-agnostic so PSN and RetroAchievements can
 * merge into the same feed later.
 */
export async function getTimeline(
  steamId: string,
  { limit = 40, before }: { limit?: number; before?: Date } = {},
): Promise<UnlockRow[]> {
  return db
    .select(unlockSelection)
    .from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .innerJoin(games, eq(games.appid, userAchievements.appid))
    .where(
      and(
        eq(userAchievements.steamId, steamId),
        isNotNull(userAchievements.unlockedAt),
        before ? sql`${userAchievements.unlockedAt} < ${before}` : undefined,
      ),
    )
    .orderBy(desc(userAchievements.unlockedAt))
    .limit(limit);
}

export interface GameProgress {
  appid: number;
  name: string;
  headerUrl: string | null;
  unlockedCount: number;
  achievementCount: number;
  playtimeForever: number;
  lastPlayedAt: Date | null;
}

/** 100% completions — Steam's answer to a platinum. */
export async function getPerfectGames(
  steamId: string,
  limit = 12,
): Promise<GameProgress[]> {
  return db
    .select({
      appid: games.appid,
      name: games.name,
      headerUrl: games.headerUrl,
      unlockedCount: userGames.unlockedCount,
      achievementCount: games.achievementCount,
      playtimeForever: userGames.playtimeForever,
      lastPlayedAt: userGames.lastPlayedAt,
    })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(
      and(
        eq(userGames.steamId, steamId),
        gt(games.achievementCount, 0),
        sql`${userGames.unlockedCount} >= ${games.achievementCount}`,
      ),
    )
    .orderBy(desc(userGames.lastPlayedAt))
    .limit(limit);
}

/** Started but unfinished — the natural "currently hunting" candidates. */
export async function getInProgressGames(
  steamId: string,
  limit = 12,
): Promise<GameProgress[]> {
  return db
    .select({
      appid: games.appid,
      name: games.name,
      headerUrl: games.headerUrl,
      unlockedCount: userGames.unlockedCount,
      achievementCount: games.achievementCount,
      playtimeForever: userGames.playtimeForever,
      lastPlayedAt: userGames.lastPlayedAt,
    })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(
      and(
        eq(userGames.steamId, steamId),
        gt(games.achievementCount, 0),
        gt(userGames.unlockedCount, 0),
        sql`${userGames.unlockedCount} < ${games.achievementCount}`,
      ),
    )
    .orderBy(
      // Closest to the finish line first: that is the useful ordering for
      // someone deciding what to chase next.
      desc(sql`cast(${userGames.unlockedCount} as real) / ${games.achievementCount}`),
    )
    .limit(limit);
}

export interface ListSummary {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  kind: string;
  itemCount: number;
}

export async function getLists(steamId: string): Promise<ListSummary[]> {
  return db
    .select({
      id: lists.id,
      name: lists.name,
      slug: lists.slug,
      description: lists.description,
      kind: lists.kind,
      itemCount: count(listItems.id),
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .where(eq(lists.steamId, steamId))
    .groupBy(lists.id)
    .orderBy(asc(lists.createdAt));
}
