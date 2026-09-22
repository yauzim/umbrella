import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Leaderboards.
 *
 * Ranking happens in SQL with a window function rather than by sorting in
 * JS, because "jump to my position" needs a person's rank even when their
 * row is thousands deep and never sent to the browser.
 */

export type LeaderboardMetric = "perfect" | "rare" | "achievements";
export type LeaderboardScope = "world" | "region" | "friends";

export const METRICS: { key: LeaderboardMetric; label: string; unit: string }[] =
  [
    { key: "perfect", label: "Completions", unit: "at 100%" },
    { key: "rare", label: "Rare unlocks", unit: "under 5%" },
    { key: "achievements", label: "Achievements", unit: "unlocked" },
  ];

/** Below this global unlock rate an achievement counts as "rare". */
const RARE_THRESHOLD = 5;

export interface LeaderboardRow {
  rank: number;
  steamId: string;
  handle: string | null;
  personaName: string;
  avatarUrl: string | null;
  countryCode: string | null;
  score: number;
  isViewer: boolean;
}

export interface LeaderboardResult {
  rows: LeaderboardRow[];
  total: number;
  /** The viewer's own standing, even when outside the visible page. */
  viewer: LeaderboardRow | null;
  /** True when the viewer cannot be placed because Steam gave no country. */
  viewerMissingRegion: boolean;
}

/** The per-user score for each metric, as a correlated subquery. */
function scoreExpression(metric: LeaderboardMetric) {
  switch (metric) {
    case "perfect":
      return sql`(
        SELECT count(*) FROM user_games ug
        JOIN games g ON g.appid = ug.appid
        WHERE ug.steam_id = u.steam_id
          AND g.achievement_count > 0
          AND ug.unlocked_count >= g.achievement_count
      )`;
    case "rare":
      return sql`(
        SELECT count(*) FROM user_achievements ua
        JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.steam_id = u.steam_id
          AND a.global_percent IS NOT NULL
          AND a.global_percent < ${RARE_THRESHOLD}
      )`;
    case "achievements":
      return sql`(
        SELECT count(*) FROM user_achievements ua
        WHERE ua.steam_id = u.steam_id
      )`;
  }
}

interface Options {
  metric: LeaderboardMetric;
  scope: LeaderboardScope;
  viewerSteamId?: string | null;
  limit?: number;
}

export async function getLeaderboard({
  metric,
  scope,
  viewerSteamId,
  limit = 50,
}: Options): Promise<LeaderboardResult> {
  // Region and friends are both relative to the viewer, so without one
  // signed in they degrade to the world board rather than erroring.
  let scopeFilter = sql`1 = 1`;
  let viewerMissingRegion = false;

  if (scope === "region") {
    if (!viewerSteamId) {
      scopeFilter = sql`1 = 0`;
    } else {
      const [me] = await db.all<{ country_code: string | null }>(
        sql`SELECT country_code FROM users WHERE steam_id = ${viewerSteamId}`,
      );
      if (!me?.country_code) {
        viewerMissingRegion = true;
        scopeFilter = sql`1 = 0`;
      } else {
        scopeFilter = sql`u.country_code = ${me.country_code}`;
      }
    }
  } else if (scope === "friends") {
    if (!viewerSteamId) {
      scopeFilter = sql`1 = 0`;
    } else {
      // Include the viewer so they can see themselves among their friends.
      scopeFilter = sql`(
        u.steam_id = ${viewerSteamId}
        OR u.steam_id IN (
          SELECT friend_steam_id FROM steam_friends WHERE steam_id = ${viewerSteamId}
        )
      )`;
    }
  }

  const score = scoreExpression(metric);

  const ranked = sql`
    SELECT steam_id, handle, persona_name, avatar_url, country_code, score,
           ROW_NUMBER() OVER (ORDER BY score DESC, persona_name ASC) AS rank
    FROM (
      SELECT u.steam_id, u.handle, u.persona_name, u.avatar_url, u.country_code,
             ${score} AS score
      FROM users u
      WHERE ${scopeFilter}
    )
    WHERE score > 0
  `;

  const rows = await db.all<{
    steam_id: string;
    handle: string | null;
    persona_name: string;
    avatar_url: string | null;
    country_code: string | null;
    score: number;
    rank: number;
  }>(sql`${ranked} ORDER BY rank LIMIT ${limit}`);

  const [totals] = await db.all<{ n: number }>(
    sql`SELECT count(*) AS n FROM (${ranked})`,
  );

  const toRow = (r: (typeof rows)[number]): LeaderboardRow => ({
    rank: r.rank,
    steamId: r.steam_id,
    handle: r.handle,
    personaName: r.persona_name,
    avatarUrl: r.avatar_url,
    countryCode: r.country_code,
    score: r.score,
    isViewer: r.steam_id === viewerSteamId,
  });

  let viewer: LeaderboardRow | null =
    rows.find((r) => r.steam_id === viewerSteamId)?.rank !== undefined
      ? toRow(rows.find((r) => r.steam_id === viewerSteamId)!)
      : null;

  // Not on the visible page: fetch just their row so we can still show
  // where they stand and offer to jump to it.
  if (!viewer && viewerSteamId) {
    const [mine] = await db.all<(typeof rows)[number]>(
      sql`SELECT * FROM (${ranked}) WHERE steam_id = ${viewerSteamId}`,
    );
    if (mine) viewer = toRow(mine);
  }

  return {
    rows: rows.map(toRow),
    total: totals?.n ?? 0,
    viewer,
    viewerMissingRegion,
  };
}
