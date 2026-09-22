/**
 * Thin typed client over the Steam Web API.
 *
 * Only the endpoints an achievement tracker actually needs. Every call
 * goes through `steamFetch`, which centralises the key, the retry policy
 * and the two failure modes that are normal rather than exceptional:
 * private profiles and games that simply have no achievements.
 */

const BASE = "https://api.steampowered.com";

function apiKey(): string {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    throw new Error(
      "STEAM_API_KEY is not set. Get one at https://steamcommunity.com/dev/apikey and add it to .env.local",
    );
  }
  return key;
}

/** Steam said no, and it is the caller's job to decide if that matters. */
export class SteamApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "SteamApiError";
  }

  /** Profile (or its game details) is not public. */
  get isPrivate() {
    return this.status === 403;
  }

  /** The app has no achievement stats at all — extremely common. */
  get isNoStats() {
    return this.status === 400;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function steamFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean>,
  { retries = 3 }: { retries?: number } = {},
): Promise<T> {
  const url = new URL(`${BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        // Steam data changes constantly and Next would otherwise cache
        // these responses across users.
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      // 429 and 5xx are worth retrying; 400/403 are answers, not failures.
      if (res.status === 429 || res.status >= 500) {
        lastError = new SteamApiError(
          `Steam returned ${res.status}`,
          res.status,
          endpoint,
        );
        if (attempt < retries) {
          await sleep(2 ** attempt * 1000 + Math.random() * 300);
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        throw new SteamApiError(
          `Steam returned ${res.status} for ${endpoint}`,
          res.status,
          endpoint,
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof SteamApiError && err.status < 500 && err.status !== 429) {
        throw err; // a definitive answer, do not retry
      }
      lastError = err;
      if (attempt < retries) {
        await sleep(2 ** attempt * 1000 + Math.random() * 300);
        continue;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Steam request failed: ${endpoint}`);
}

/* ------------------------------------------------------------------ */
/* Player summary                                                      */
/* ------------------------------------------------------------------ */

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
  /** 1 = private, 3 = public. Anything below 3 means we cannot read stats. */
  communityvisibilitystate: number;
}

export async function getPlayerSummary(
  steamId: string,
): Promise<SteamPlayerSummary | null> {
  const data = await steamFetch<{
    response: { players: SteamPlayerSummary[] };
  }>("/ISteamUser/GetPlayerSummaries/v0002/", {
    key: apiKey(),
    steamids: steamId,
  });
  return data.response.players[0] ?? null;
}

/** Turn a /id/<name> vanity URL into a SteamID64. */
export async function resolveVanityUrl(name: string): Promise<string | null> {
  const data = await steamFetch<{
    response: { success: number; steamid?: string };
  }>("/ISteamUser/ResolveVanityURL/v0001/", {
    key: apiKey(),
    vanityurl: name,
  });
  return data.response.success === 1 ? (data.response.steamid ?? null) : null;
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number; // minutes
  playtime_2weeks?: number;
  img_icon_url?: string;
  rtime_last_played?: number; // unix seconds
}

/**
 * Returns null when the library is private — distinct from an empty
 * array, which means a public profile that genuinely owns nothing.
 */
export async function getOwnedGames(
  steamId: string,
): Promise<SteamOwnedGame[] | null> {
  const data = await steamFetch<{
    response: { game_count?: number; games?: SteamOwnedGame[] };
  }>("/IPlayerService/GetOwnedGames/v0001/", {
    key: apiKey(),
    steamid: steamId,
    include_appinfo: true,
    include_played_free_games: true,
  });

  // A private library is not an error to Steam: it returns `{response:{}}`
  // with no `games` key at all.
  if (!data.response || data.response.games === undefined) {
    return data.response?.game_count === 0 ? [] : null;
  }
  return data.response.games;
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

export interface SteamPlayerAchievement {
  apiname: string;
  achieved: 0 | 1;
  /** Unix seconds. 0 means "earned before Steam recorded timestamps". */
  unlocktime: number;
}

export type PlayerAchievementsResult =
  | { status: "ok"; achievements: SteamPlayerAchievement[] }
  | { status: "no_stats" }
  | { status: "private" };

export async function getPlayerAchievements(
  steamId: string,
  appid: number,
): Promise<PlayerAchievementsResult> {
  try {
    const data = await steamFetch<{
      playerstats: {
        success: boolean;
        error?: string;
        achievements?: SteamPlayerAchievement[];
      };
    }>("/ISteamUserStats/GetPlayerAchievements/v0001/", {
      key: apiKey(),
      steamid: steamId,
      appid,
      l: "english",
    });

    if (!data.playerstats?.success) {
      return { status: "no_stats" };
    }
    return { status: "ok", achievements: data.playerstats.achievements ?? [] };
  } catch (err) {
    if (err instanceof SteamApiError) {
      // 400 = app has no stats, 403 = profile is private. Both are routine
      // during a full library sync and must not abort it.
      if (err.isNoStats) return { status: "no_stats" };
      if (err.isPrivate) return { status: "private" };
    }
    throw err;
  }
}

export interface SteamSchemaAchievement {
  name: string; // api name
  displayName: string;
  description?: string;
  icon: string;
  icongray: string;
  hidden: 0 | 1;
}

/** Achievement definitions for a game. Identical for every user. */
export async function getSchemaForGame(
  appid: number,
): Promise<SteamSchemaAchievement[] | null> {
  try {
    const data = await steamFetch<{
      game?: {
        availableGameStats?: { achievements?: SteamSchemaAchievement[] };
      };
    }>("/ISteamUserStats/GetSchemaForGame/v2/", {
      key: apiKey(),
      appid,
      l: "english",
    });
    return data.game?.availableGameStats?.achievements ?? null;
  } catch (err) {
    if (err instanceof SteamApiError && (err.isNoStats || err.isPrivate)) {
      return null;
    }
    throw err;
  }
}

/** Global unlock rate per achievement — the rarity numbers. */
export async function getGlobalAchievementPercentages(
  appid: number,
): Promise<Map<string, number>> {
  try {
    const data = await steamFetch<{
      achievementpercentages?: {
        achievements?: { name: string; percent: number }[];
      };
    }>("/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/", {
      // Note: this endpoint takes `gameid`, not `appid`, and needs no key.
      gameid: appid,
    });
    const rows = data.achievementpercentages?.achievements ?? [];
    return new Map(rows.map((a) => [a.name, a.percent]));
  } catch (err) {
    if (err instanceof SteamApiError && (err.isNoStats || err.isPrivate)) {
      return new Map();
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Asset URLs                                                          */
/* ------------------------------------------------------------------ */

export function gameIconUrl(appid: number, hash?: string): string | null {
  if (!hash) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
}

export function gameHeaderUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

/** Run async work over a list with bounded concurrency. */
export async function pooled<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
