/**
 * Seeds a clearly-labelled demo profile so the UI can be developed without
 * a Steam key.
 *
 * IMPORTANT: this uses a reserved fake appid range, never real ones.
 *
 * An earlier version seeded synthetic achievements against real appids
 * (Elden Ring, Hollow Knight…). That corrupted real game pages two ways:
 * invented achievements appeared alongside genuine ones, and because the
 * seed also stamped `schema_synced_at`, the real sync treated those games
 * as cached and never fetched their actual Steam schemas. Keeping fixtures
 * in their own id range makes that class of bug impossible.
 *
 *   node scripts/seed-demo.mjs          # add fixtures
 *   node scripts/seed-demo.mjs --clean  # remove them
 */
import Database from "better-sqlite3";

const DEMO_STEAM_ID = "76561190000000001";
/** Real Steam appids are well below this; nothing here can collide. */
const FAKE_APPID_BASE = 900000001;

const db = new Database(process.env.DATABASE_URL ?? "./umbrella.db");
db.pragma("foreign_keys = ON");

const secs = (d) => Math.floor(d.getTime() / 1000);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

if (process.argv.includes("--clean")) {
  db.exec("BEGIN");
  db.prepare("DELETE FROM users WHERE steam_id = ?").run(DEMO_STEAM_ID);
  db.prepare("DELETE FROM games WHERE appid >= ?").run(FAKE_APPID_BASE);
  db.exec("COMMIT");
  console.log("Demo fixtures removed.");
  process.exit(0);
}

// Names are invented too — no real game's page can be affected.
const GAMES = [
  { name: "Hollow Reverie (demo)", total: 63, done: 63, mins: 7420 },
  { name: "Summit Dash (demo)", total: 42, done: 42, mins: 3110 },
  { name: "Underworld Run (demo)", total: 49, done: 49, mins: 5980 },
  { name: "Ashen Realm (demo)", total: 42, done: 31, mins: 12400 },
  { name: "Cinder Souls (demo)", total: 43, done: 28, mins: 8830 },
  { name: "Pixel Frontier (demo)", total: 115, done: 88, mins: 15200 },
  { name: "Test Chamber (demo)", total: 51, done: 44, mins: 1890 },
  { name: "Harvest Vale (demo)", total: 40, done: 22, mins: 6600 },
];

const NOTABLE = [
  [0, "Steel Soul", "Finish in a single life.", 0.4],
  [0, "Full Pantheon", "Defeat every boss consecutively.", 0.7],
  [1, "Golden Berry", "Clear a chapter without dying.", 1.9],
  [2, "Hell Mode", "Clear a run on the hardest setting.", 3.2],
  [3, "Realm Lord", "Reach the true ending.", 12.4],
  [4, "The Usurper", "Reach the hidden ending.", 18.1],
  [5, "Bulldozer", "Break every kind of block.", 31.5],
  [6, "Professor", "Complete every test chamber.", 46.8],
  [7, "Arcade Champion", "Score 50,000 in the minigame.", 2.1],
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
    "Local fixture account — every game and unlock here is invented.",
    "#f5a524",
    null,
    "dark",
    secs(daysAgo(400)),
    secs(new Date()),
  );

  const insGame = db.prepare(
    `INSERT INTO games (appid, name, icon_url, header_url, hero_url, logo_url,
       has_achievements, achievement_count, schema_synced_at, rarity_synced_at, art_checked_at)
     VALUES (?,?,NULL,NULL,NULL,NULL,1,?,?,?,?)
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

  GAMES.forEach((g, gi) => {
    const appid = FAKE_APPID_BASE + gi;
    insGame.run(appid, g.name, g.total, now, now, now);
    insUserGame.run(DEMO_STEAM_ID, appid, g.mins, secs(daysAgo(day)), g.done, now);

    for (let i = 0; i < g.total; i++) {
      const { id } = insAch.get(
        appid,
        `DEMO_${appid}_${i}`,
        `${g.name} milestone ${i + 1}`,
        null,
        Math.round((90 / (i + 1.4) + 2) * 10) / 10,
      );
      if (i < g.done) {
        insUnlock.run(DEMO_STEAM_ID, id, appid, secs(daysAgo(day + i * 2)));
      }
    }
    day += 22;
  });

  let offset = 3;
  for (const [gameIndex, name, desc, percent] of NOTABLE) {
    const appid = FAKE_APPID_BASE + gameIndex;
    const { id } = insAch.get(
      appid,
      `DEMO_NOTABLE_${name.replace(/\W+/g, "_")}`,
      name,
      desc,
      percent,
    );
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
console.log(`Seeded demo profile: ${n} unlocks on fixture games. Visit /u/demo`);
console.log("Remove with: node scripts/seed-demo.mjs --clean");
