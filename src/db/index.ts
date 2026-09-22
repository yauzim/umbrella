import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_FILE = process.env.DATABASE_URL ?? "./umbrella.db";

// Next.js hot-reloads modules in dev, which would otherwise open a new
// SQLite handle on every edit until the process runs out of file handles.
const globalForDb = globalThis as unknown as {
  __umbrellaSqlite?: Database.Database;
};

function createConnection() {
  const sqlite = new Database(DB_FILE);
  // WAL lets reads proceed during the long write transactions a library
  // sync produces.
  sqlite.pragma("journal_mode = WAL");
  // SQLite ignores foreign keys unless asked, which would silently defeat
  // every onDelete: "cascade" in the schema.
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

const sqlite = globalForDb.__umbrellaSqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__umbrellaSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { schema };
