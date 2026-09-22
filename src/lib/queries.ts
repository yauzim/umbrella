import { and, asc, count, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  favoriteGames,
  FAVORITE_SLOTS,
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

/**
 * The showcase: hardest things this person has ever done.
 *
 * Capped per game. Some titles (Forza especially) are stuffed with
 * sub-1% achievements, and without a cap the showcase becomes six rows
 * of the same game — which reads as "plays a lot of X" rather than
 * showing the range of hard things they have finished.
 */
export async function getRarestUnlocks(
  steamId: string,
  limit = 6,
  perGame = 2,
): Promise<UnlockRow[]> {
  const rows = await db.all<{
    achievementId: number;
    displayName: string;
    description: string | null;
    icon: string | null;
    globalPercent: number | null;
    unlockedAt: number | null;
    appid: number;
    gameName: string;
    gameHeaderUrl: string | null;
  }>(sql`
    SELECT achievement_id AS achievementId,
           display_name   AS displayName,
           description,
           icon,
           global_percent AS globalPercent,
           unlocked_at    AS unlockedAt,
           appid,
           game_name      AS gameName,
           game_header    AS gameHeaderUrl
    FROM (
      SELECT a.id            AS achievement_id,
             a.display_name,
             a.description,
             a.icon,
             a.global_percent,
             ua.unlocked_at,
             ua.appid,
             g.name          AS game_name,
             g.header_url    AS game_header,
             ROW_NUMBER() OVER (
               PARTITION BY ua.appid ORDER BY a.global_percent ASC, a.id ASC
             ) AS rn
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      JOIN games g        ON g.appid = ua.appid
      WHERE ua.steam_id = ${steamId}
        AND a.global_percent IS NOT NULL
    )
    WHERE rn <= ${perGame}
    ORDER BY global_percent ASC
    LIMIT ${limit}
  `);

  // The raw query returns unix seconds; the rest of the app expects Dates.
  return rows.map((r) => ({
    ...r,
    unlockedAt: r.unlockedAt ? new Date(r.unlockedAt * 1000) : null,
  }));
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

const progressSelection = {
  appid: games.appid,
  name: games.name,
  headerUrl: games.headerUrl,
  unlockedCount: userGames.unlockedCount,
  achievementCount: games.achievementCount,
  playtimeForever: userGames.playtimeForever,
  lastPlayedAt: userGames.lastPlayedAt,
};

/** The four games a person pinned under their name, in their order. */
export async function getFavoriteGames(
  steamId: string,
): Promise<GameProgress[]> {
  return db
    .select(progressSelection)
    .from(favoriteGames)
    .innerJoin(games, eq(games.appid, favoriteGames.appid))
    .innerJoin(
      userGames,
      and(
        eq(userGames.appid, favoriteGames.appid),
        eq(userGames.steamId, steamId),
      ),
    )
    .where(eq(favoriteGames.steamId, steamId))
    .orderBy(asc(favoriteGames.position))
    .limit(FAVORITE_SLOTS);
}

/** What they have actually been playing, newest first. */
export async function getRecentGames(
  steamId: string,
  limit = 4,
): Promise<GameProgress[]> {
  return db
    .select(progressSelection)
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(
      and(eq(userGames.steamId, steamId), isNotNull(userGames.lastPlayedAt)),
    )
    .orderBy(desc(userGames.lastPlayedAt))
    .limit(limit);
}

/**
 * Resolves the avatar with the precedence the profile promises:
 * an earned achievement icon, then a game icon, then the Steam avatar.
 * Nothing here can be an arbitrary upload — it is all earned art.
 */
export async function resolveAvatarUrl(
  user: ProfileUser,
): Promise<string | null> {
  if (user.avatarAchievementId) {
    const [row] = await db
      .select({ icon: achievements.icon })
      .from(achievements)
      // Only honour it if they still hold the achievement.
      .innerJoin(
        userAchievements,
        and(
          eq(userAchievements.achievementId, achievements.id),
          eq(userAchievements.steamId, user.steamId),
        ),
      )
      .where(eq(achievements.id, user.avatarAchievementId))
      .limit(1);
    if (row?.icon) return row.icon;
  }

  if (user.avatarAppid) {
    const [row] = await db
      .select({ icon: games.iconUrl, header: games.headerUrl })
      .from(games)
      .where(eq(games.appid, user.avatarAppid))
      .limit(1);
    if (row?.icon || row?.header) return row.icon ?? row.header;
  }

  return user.avatarUrl;
}

/** Resolved cover art for one game, or null if it has none. */
export async function getGameHeaderUrl(
  appid: number | null,
): Promise<string | null> {
  if (!appid) return null;
  const [row] = await db
    .select({ headerUrl: games.headerUrl })
    .from(games)
    .where(eq(games.appid, appid))
    .limit(1);
  return row?.headerUrl ?? null;
}

export interface PickerGame {
  appid: number;
  name: string;
  headerUrl: string | null;
  iconUrl: string | null;
  playtimeForever: number;
  unlockedCount: number;
  achievementCount: number;
}

/**
 * Games offered in the customization pickers. Played games only, most
 * played first — the point is that your profile is furnished from what
 * you have actually played, not from an upload box.
 */
export async function getPickerGames(
  steamId: string,
  { perfectOnly = false, limit = 120 } = {},
): Promise<PickerGame[]> {
  return db
    .select({
      appid: games.appid,
      name: games.name,
      headerUrl: games.headerUrl,
      iconUrl: games.iconUrl,
      playtimeForever: userGames.playtimeForever,
      unlockedCount: userGames.unlockedCount,
      achievementCount: games.achievementCount,
    })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(
      and(
        eq(userGames.steamId, steamId),
        gt(userGames.playtimeForever, 0),
        perfectOnly
          ? and(
              gt(games.achievementCount, 0),
              sql`${userGames.unlockedCount} >= ${games.achievementCount}`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(userGames.playtimeForever))
    .limit(limit);
}

export interface PickerAchievement {
  id: number;
  displayName: string;
  icon: string | null;
  globalPercent: number | null;
  gameName: string;
}

/** Earned achievements usable as an avatar — rarest first, since those
 *  are the ones worth wearing. */
export async function getPickerAchievements(
  steamId: string,
  limit = 60,
): Promise<PickerAchievement[]> {
  return db
    .select({
      id: achievements.id,
      displayName: achievements.displayName,
      icon: achievements.icon,
      globalPercent: achievements.globalPercent,
      gameName: games.name,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .innerJoin(games, eq(games.appid, userAchievements.appid))
    .where(
      and(eq(userAchievements.steamId, steamId), isNotNull(achievements.icon)),
    )
    .orderBy(asc(achievements.globalPercent))
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
