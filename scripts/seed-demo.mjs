/**
 * Seeds a clearly-labelled demo profile so the UI can be developed without
 * burning Steam API calls (or needing a key at all).
 *
 * Game names and appids are real so the CDN art loads; the unlocks and
 * rarity figures are invented. This is a fixture, not Steam data.
 *
 *   node scripts/seed-demo.mjs
 */
import Database from "better-sqlite3";

const DEMO_STEAM_ID = "76561190000000001";
const db = new Database(process.env.DATABASE_URL ?? "./umbrella.db");
db.pragma("foreign_keys = ON");

const secs = (d) => Math.floor(d.getTime() / 1000);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

const GAMES = [
  { appid: 367520, name: "Hollow Knight", total: 63, done: 63, mins: 7420 },
  { appid: 504230, name: "Celeste", total: 42, done: 42, mins: 3110 },
  { appid: 1145360, name: "Hades", total: 49, done: 49, mins: 5980 },
  { appid: 1245620, name: "ELDEN RING", total: 42, done: 31, mins: 12400 },
  { appid: 374320, name: "DARK SOULS III", total: 43, done: 28, mins: 8830 },
  { appid: 105600, name: "Terraria", total: 115, done: 88, mins: 15200 },
  { appid: 620, name: "Portal 2", total: 51, done: 44, mins: 1890 },
  { appid: 413150, name: "Stardew Valley", total: 40, done: 22, mins: 6600 },
];

// Spread across every rarity tier so the visual language is exercised.
const NOTABLE = [
  [367520, "Steel Soul", "Complete the game in Steel Soul mode.", 0.4],
  [367520, "Pantheon of Hallownest", "Defeat the Pantheon of Hallownest.", 0.7],
  [504230, "Golden Strawberry", "Complete a chapter without dying.", 1.9],
  [1145360, "Hell Mode", "Clear an escape attempt on Hell Mode.", 3.2],
  [1245620, "Elden Lord", "Obtain the Elden Lord ending.", 12.4],
  [374320, "The Usurper", "Reach the Usurpation of Fire ending.", 18.1],
  [105600, "Bulldozer", "Break every kind of block.", 31.5],
  [620, "Professor Portal", "Complete all test chambers.", 46.8],
  [413150, "Fector's Challenge", "Score 50,000 points in Journey of the Prairie King.", 2.1],
  [1145360, "Is There No Escape?", "Escape the Underworld for the first time.", 58.0],
];

db.exec("BEGIN");
try {
  db.prepare(
    `INSERT INTO users (steam_id, persona_name, avatar_url, profile_url, handle,
       bio, accent_color, banner_appid, theme, created_at, library_synced_at, profile_is_private)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0)
     ON CONFLICT(steam_id) DO UPDATE SET library_synced_at = excluded.library_synced_at`,
  ).run(
    DEMO_STEAM_ID,
    "Demo Hunter",
    null,
    null,
    "demo",
    "Local fixture account — every unlock below is invented, not Steam data.",
    "#f5a524",
    367520,
    "dark",
    secs(daysAgo(400)),
    secs(new Date()),
  );

  const insGame = db.prepare(
    `INSERT INTO games (appid, name, icon_url, header_url, has_achievements, achievement_count, schema_synced_at, rarity_synced_at)
     VALUES (?,?,?,?,1,?,?,?)
     ON CONFLICT(appid) DO UPDATE SET achievement_count = excluded.achievement_count`,
  );
  const insUserGame = db.prepare(
    `INSERT INTO user_games (steam_id, appid, playtime_forever, playtime_2weeks, last_played_at, unlocked_count, achievements_synced_at)
     VALUES (?,?,?,0,?,?,?)
     ON CONFLICT(steam_id, appid) DO UPDATE SET unlocked_count = excluded.unlocked_count`,
  );
  const insAch = db.prepare(
    `INSERT INTO achievements (appid, api_name, display_name, description, icon, icon_gray, hidden, global_percent)
     VALUES (?,?,?,?,NULL,NULL,0,?)
     ON CONFLICT(appid, api_name) DO UPDATE SET global_percent = excluded.global_percent
     RETURNING id`,
  );
  const insUnlock = db.prepare(
    `INSERT INTO user_achievements (steam_id, achievement_id, appid, unlocked_at)
     VALUES (?,?,?,?) ON CONFLICT(steam_id, achievement_id) DO NOTHING`,
  );

  const now = secs(new Date());
  let day = 5;

  for (const g of GAMES) {
    insGame.run(
      g.appid,
      g.name,
      null,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
      g.total,
      now,
      now,
    );
    insUserGame.run(
      DEMO_STEAM_ID,
      g.appid,
      g.mins,
      secs(daysAgo(day)),
      g.done,
      now,
    );

    // Filler achievements so counts and completion percentages are real.
    for (let i = 0; i < g.total; i++) {
      const isDone = i < g.done;
      const { id } = insAch.get(
        g.appid,
        `ACH_${g.appid}_${i}`,
        `${g.name} milestone ${i + 1}`,
        null,
        // Plausible long-tail rarity curve.
        Math.round((90 / (i + 1.4) + 2) * 10) / 10,
      );
      if (isDone) {
        insUnlock.run(DEMO_STEAM_ID, id, g.appid, secs(daysAgo(day + i * 2)));
      }
    }
    day += 22;
  }

  // Named showcase pieces, overwriting the filler at the rare end.
  let offset = 3;
  for (const [appid, name, desc, percent] of NOTABLE) {
    const { id } = insAch.get(appid, `ACH_NOTABLE_${name.replace(/\W+/g, "_")}`, name, desc, percent);
    insUnlock.run(DEMO_STEAM_ID, id, appid, secs(daysAgo(offset)));
    offset += 17;
  }

  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}

const n = db
  .prepare("SELECT count(*) AS n FROM user_achievements WHERE steam_id = ?")
  .get(DEMO_STEAM_ID).n;
console.log(`Seeded demo profile: ${n} unlocks. Visit /u/demo`);
