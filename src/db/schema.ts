import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/sqlite-core";

/* ---------------------------------------------------------------
 * GLOBAL CACHE
 * Game schemas and rarity are identical for every user, so they are
 * fetched once and shared. This is what keeps us under Steam's
 * ~100k calls/day budget: a 500-game library costs 500 achievement
 * calls for that user, but zero schema calls if anyone synced the
 * game before.
 * ------------------------------------------------------------- */

export const games = sqliteTable("games", {
  appid: integer("appid").primaryKey(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  headerUrl: text("header_url"),
  // null = not checked yet; false = confirmed to have no achievements
  hasAchievements: integer("has_achievements", { mode: "boolean" }),
  achievementCount: integer("achievement_count").notNull().default(0),
  schemaSyncedAt: integer("schema_synced_at", { mode: "timestamp" }),
  raritySyncedAt: integer("rarity_synced_at", { mode: "timestamp" }),
  // Recent releases serve header art from a path containing a content
  // hash, which cannot be constructed from the appid — it has to be read
  // from the store API. Once checked, the resolved URL lives in headerUrl
  // and this stamp stops us asking again.
  artCheckedAt: integer("art_checked_at", { mode: "timestamp" }),
});

export const achievements = sqliteTable(
  "achievements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appid: integer("appid")
      .notNull()
      .references(() => games.appid, { onDelete: "cascade" }),
    // Steam's internal key, e.g. "ACH_WIN_ONE_GAME"
    apiName: text("api_name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    icon: text("icon"),
    iconGray: text("icon_gray"),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    // Percent of owners holding it. THE rarity number: 0.3 = ultra rare.
    globalPercent: real("global_percent"),
  },
  (t) => [
    unique("achievements_appid_api_name").on(t.appid, t.apiName),
    index("achievements_appid_idx").on(t.appid),
    index("achievements_rarity_idx").on(t.globalPercent),
  ],
);

/* ---------------------------------------------------------------
 * USERS
 * ------------------------------------------------------------- */

export const users = sqliteTable("users", {
  // SteamID64, e.g. "76561198000000000". Stored as text because it
  // overflows JS number precision.
  steamId: text("steam_id").primaryKey(),
  personaName: text("persona_name").notNull(),
  avatarUrl: text("avatar_url"),
  profileUrl: text("profile_url"),

  // --- profile customization: the whole point of the product ---
  // Everything here is *earned*, never uploaded. You decorate a profile
  // with the games you own and the achievements you actually unlocked,
  // the way PSN and Xbox used to. No arbitrary image uploads.
  handle: text("handle").unique(), // vanity slug for /u/<handle>
  bio: text("bio"),
  accentColor: text("accent_color").notNull().default("#5b8def"),
  bannerAppid: integer("banner_appid"), // a game's art as your banner
  // Avatar precedence: achievement icon > game icon > Steam avatar.
  avatarAppid: integer("avatar_appid"),
  avatarAchievementId: integer("avatar_achievement_id"),
  theme: text("theme").notNull().default("dark"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  librarySyncedAt: integer("library_synced_at", { mode: "timestamp" }),
  // Set when Steam reports a private profile, so the UI can explain why
  // the page is empty instead of silently showing nothing.
  profileIsPrivate: integer("profile_is_private", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const userGames = sqliteTable(
  "user_games",
  {
    steamId: text("steam_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    appid: integer("appid")
      .notNull()
      .references(() => games.appid, { onDelete: "cascade" }),
    playtimeForever: integer("playtime_forever").notNull().default(0), // minutes
    playtime2Weeks: integer("playtime_2weeks").notNull().default(0),
    lastPlayedAt: integer("last_played_at", { mode: "timestamp" }),
    unlockedCount: integer("unlocked_count").notNull().default(0),
    achievementsSyncedAt: integer("achievements_synced_at", {
      mode: "timestamp",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.steamId, t.appid] }),
    index("user_games_steam_idx").on(t.steamId),
  ],
);

export const userAchievements = sqliteTable(
  "user_achievements",
  {
    steamId: text("steam_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    achievementId: integer("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    appid: integer("appid").notNull(), // denormalised: every feed query needs it
    // Steam returns unlocktime 0 for achievements earned before it began
    // recording timestamps (~2009). Stored as null rather than epoch 0 so
    // the timeline can honestly say "date unknown" instead of claiming 1970.
    unlockedAt: integer("unlocked_at", { mode: "timestamp" }),
  },
  (t) => [
    primaryKey({ columns: [t.steamId, t.achievementId] }),
    // The unified timeline query: one user's unlocks, newest first.
    index("user_ach_timeline_idx").on(t.steamId, t.unlockedAt),
    index("user_ach_app_idx").on(t.steamId, t.appid),
  ],
);

/* ---------------------------------------------------------------
 * PLAYTIME SNAPSHOTS
 * Steam exposes total playtime and unlock time, but never "playtime at
 * the moment of unlock". Polling and storing snapshots is the only way
 * to ever say "she got this at hour 62", so we start collecting on day
 * one even though the feature ships later — the data cannot be
 * recovered retroactively.
 * ------------------------------------------------------------- */

export const playtimeSnapshots = sqliteTable(
  "playtime_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    steamId: text("steam_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    appid: integer("appid").notNull(),
    playtimeForever: integer("playtime_forever").notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("snapshots_lookup_idx").on(t.steamId, t.appid, t.capturedAt)],
);

/* ---------------------------------------------------------------
 * LISTS  (the Letterboxd half)
 * ------------------------------------------------------------- */

export const lists = sqliteTable(
  "lists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    steamId: text("steam_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    // backlog | hunting | custom. 'hunting' is the one that makes this an
    // achievement site rather than a games site.
    kind: text("kind").notNull().default("custom"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    ranked: integer("ranked", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [unique("lists_owner_slug").on(t.steamId, t.slug)],
);

export const listItems = sqliteTable(
  "list_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    appid: integer("appid")
      .notNull()
      .references(() => games.appid, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    note: text("note"),
  },
  (t) => [
    unique("list_items_unique_game").on(t.listId, t.appid),
    index("list_items_list_idx").on(t.listId, t.position),
  ],
);

/* ---------------------------------------------------------------
 * FAVOURITES
 * The four games a person chooses to put directly under their name.
 * Deliberately capped: a shelf with everything on it says nothing, and
 * a small fixed number keeps setup to a minute rather than an evening.
 * ------------------------------------------------------------- */

export const FAVORITE_SLOTS = 4;

export const favoriteGames = sqliteTable(
  "favorite_games",
  {
    steamId: text("steam_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    appid: integer("appid")
      .notNull()
      .references(() => games.appid, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.steamId, t.appid] }),
    index("favorites_owner_idx").on(t.steamId, t.position),
  ],
);

/* ---------------------------------------------------------------
 * SHOWCASES
 * An ordered set of blocks the user arranges on their profile. Steam
 * gives you a fixed grid; this is the part that was missing. `config`
 * is JSON because each kind has a different shape.
 * ------------------------------------------------------------- */

export type ShowcaseKind =
  | "rarest"
  | "recent"
  | "pinned"
  | "perfect_games"
  | "stats"
  | "featured_game"
  | "list";

export const showcases = sqliteTable(
  "showcases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    steamId: text("steam_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    kind: text("kind").$type<ShowcaseKind>().notNull(),
    position: integer("position").notNull().default(0),
    config: text("config", { mode: "json" })
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
  },
  (t) => [index("showcases_owner_idx").on(t.steamId, t.position)],
);

/* ---------------------------------------------------------------
 * SOCIAL
 * ------------------------------------------------------------- */

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.steamId, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
  ],
);
