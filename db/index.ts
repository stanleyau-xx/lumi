import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const DATABASE_URL = process.env.DATABASE_URL || "file:./data/db.sqlite";

function getDbPath(): string {
  if (DATABASE_URL.startsWith("file:")) {
    return DATABASE_URL.slice(5);
  }
  return DATABASE_URL;
}

const dbPath = getDbPath();
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Auto-migration: add columns introduced after initial schema push.
// SQLite doesn't support ALTER TABLE ... ADD COLUMN IF NOT EXISTS,
// so we swallow the "duplicate column" error when the column already exists.
const safeAddColumn = (table: string, column: string, definition: string) => {
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists — fine.
  }
};

safeAddColumn("messages", "parent_id", "text");
safeAddColumn("users", "full_name", "text");
safeAddColumn("users", "last_login_at", "integer");
safeAddColumn("conversations", "active_branches", "text");
safeAddColumn("models", "description", "text");

// Back-fill full_name for existing accounts that don't have one yet.
try {
  sqlite.exec(`UPDATE users SET full_name = username WHERE full_name IS NULL`);
} catch {
  // Table doesn't exist yet (e.g. during Docker build) — no-op.
}

export const db = drizzle(sqlite, { schema });

export { schema };
