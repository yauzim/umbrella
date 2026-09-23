import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  gameReviews,
  games,
  userAchievements,
  userGames,
  users,
} from "@/db/schema";

export interface GameDetail {
  appid: number;
  name: string;
  headerUrl: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
  achievementCount: number;
}

export async function getGame(appid: number): Promise<GameDetail | null> {
  const [row] = await db
    .select({
      appid: games.appid,
      name: games.name,
      headerUrl: games.headerUrl,
      heroUrl: games.heroUrl,
      logoUrl: games.logoUrl,
      achievementCount: games.achievementCount,
    })
    .from(games)
    .where(eq(games.appid, appid))
    .limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Completion context — the HowLongToBeat-shaped part                  */
/* ------------------------------------------------------------------ */

export interface CompletionStats {
  /** People here who took the game to 100%. */
  completers: number;
  /** Median hours among them. Median, not mean: one 900-hour idler
   *  would otherwise make a 20-hour game look like a career. */
  medianHoursToComplete: number | null;
  /** Everyone here who has played it at all. */
  players: number;
  medianHoursPlayed: number | null;
  averageCompletionPercent: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function getCompletionStats(
  appid: number,
): Promise<CompletionStats> {
  const rows = await db
    .select({
      playtime: userGames.playtimeForever,
      unlocked: userGames.unlockedCount,
      total: games.achievementCount,
    })
    .from(userGames)
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(and(eq(userGames.appid, appid), sql`${userGames.playtimeForever} > 0`));

  const completed = rows.filter((r) => r.total > 0 && r.unlocked >= r.total);

  const pcts = rows
    .filter((r) => r.total > 0)
    .map((r) => Math.min(100, (r.unlocked / r.total) * 100));

  return {
    completers: completed.length,
    medianHoursToComplete: median(completed.map((r) => r.playtime / 60)),
    players: rows.length,
    medianHoursPlayed: median(rows.map((r) => r.playtime / 60)),
    averageCompletionPercent: pcts.length
      ? pcts.reduce((a, b) => a + b, 0) / pcts.length
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export interface ReviewRow {
  steamId: string;
  handle: string | null;
  personaName: string;
  avatarUrl: string | null;
  rating: number | null;
  body: string | null;
  containsSpoilers: boolean;
  createdAt: Date;
  /** Shown beside the review: what this person actually did in the game. */
  unlockedCount: number;
  achievementCount: number;
  playtimeForever: number;
}

export async function getGameReviews(
  appid: number,
  limit = 25,
): Promise<ReviewRow[]> {
  return db
    .select({
      steamId: gameReviews.steamId,
      handle: users.handle,
      personaName: users.personaName,
      avatarUrl: users.avatarUrl,
      rating: gameReviews.rating,
      body: gameReviews.body,
      containsSpoilers: gameReviews.containsSpoilers,
      createdAt: gameReviews.createdAt,
      unlockedCount: sql<number>`coalesce(${userGames.unlockedCount}, 0)`,
      achievementCount: games.achievementCount,
      playtimeForever: sql<number>`coalesce(${userGames.playtimeForever}, 0)`,
    })
    .from(gameReviews)
    .innerJoin(users, eq(users.steamId, gameReviews.steamId))
    .innerJoin(games, eq(games.appid, gameReviews.appid))
    .leftJoin(
      userGames,
      and(
        eq(userGames.appid, gameReviews.appid),
        eq(userGames.steamId, gameReviews.steamId),
      ),
    )
    .where(eq(gameReviews.appid, appid))
    .orderBy(desc(gameReviews.createdAt))
    .limit(limit);
}

export interface RatingSummary {
  average: number | null; // half-stars, 1–10
  count: number;
  /** Histogram indexed 1–10 by half-star value. */
  distribution: number[];
}

export async function getRatingSummary(
  appid: number,
): Promise<RatingSummary> {
  const rows = await db
    .select({ rating: gameReviews.rating })
    .from(gameReviews)
    .where(and(eq(gameReviews.appid, appid), isNotNull(gameReviews.rating)));

  const values = rows.map((r) => r.rating!).filter(Boolean);
  const distribution = Array(11).fill(0);
  for (const v of values) distribution[v]++;

  return {
    average: values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null,
    count: values.length,
    distribution,
  };
}

export async function getMyReview(steamId: string, appid: number) {
  const [row] = await db
    .select()
    .from(gameReviews)
    .where(
      and(eq(gameReviews.steamId, steamId), eq(gameReviews.appid, appid)),
    )
    .limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Achievements for one game, with the viewer's progress               */
/* ------------------------------------------------------------------ */

export interface GameAchievementRow {
  id: number;
  displayName: string;
  description: string | null;
  icon: string | null;
  iconGray: string | null;
  globalPercent: number | null;
  unlockedAt: Date | null;
  unlocked: boolean;
}

export async function getGameAchievements(
  appid: number,
  steamId: string | null,
): Promise<GameAchievementRow[]> {
  const rows = await db
    .select({
      id: achievements.id,
      displayName: achievements.displayName,
      description: achievements.description,
      icon: achievements.icon,
      iconGray: achievements.iconGray,
      globalPercent: achievements.globalPercent,
      unlockedAt: steamId ? userAchievements.unlockedAt : sql<null>`NULL`,
      unlockedFlag: steamId
        ? sql<number>`CASE WHEN ${userAchievements.steamId} IS NULL THEN 0 ELSE 1 END`
        : sql<number>`0`,
    })
    .from(achievements)
    .leftJoin(
      userAchievements,
      steamId
        ? and(
            eq(userAchievements.achievementId, achievements.id),
            eq(userAchievements.steamId, steamId),
          )
        : sql`1 = 0`,
    )
    .where(eq(achievements.appid, appid))
    .orderBy(asc(achievements.globalPercent));

  return rows.map(({ unlockedFlag, ...r }) => ({
    ...r,
    unlocked: unlockedFlag === 1,
  }));
}

/** Who else here has played it — a small social proof strip. */
export async function getGamePlayers(appid: number, limit = 12) {
  return db
    .select({
      steamId: users.steamId,
      handle: users.handle,
      personaName: users.personaName,
      avatarUrl: users.avatarUrl,
      unlockedCount: userGames.unlockedCount,
      achievementCount: games.achievementCount,
    })
    .from(userGames)
    .innerJoin(users, eq(users.steamId, userGames.steamId))
    .innerJoin(games, eq(games.appid, userGames.appid))
    .where(and(eq(userGames.appid, appid), sql`${userGames.playtimeForever} > 0`))
    .orderBy(desc(userGames.unlockedCount))
    .limit(limit);
}
