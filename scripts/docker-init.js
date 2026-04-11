/**
 * Standalone Docker init script (plain JS, no TypeScript required).
 * Creates all tables and seeds the admin user + default settings.
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Locate better-sqlite3 relative to this script
const Database = require(path.join(__dirname, "../node_modules/better-sqlite3"));
const bcrypt = require(path.join(__dirname, "../node_modules/bcryptjs"));

const dbUrl = process.env.DATABASE_URL || "file:/app/data/db.sqlite";
const dbPath = dbUrl.replace(/^file:/, "");

// Ensure directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Create tables ─────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_url TEXT,
    auth_method TEXT NOT NULL,
    api_key TEXT,
    oauth_client_id TEXT,
    oauth_client_secret TEXT,
    oauth_token_url TEXT,
    oauth_access_token TEXT,
    oauth_refresh_token TEXT,
    oauth_expires_at INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    display_name TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    model_id TEXT REFERENCES models(id),
    provider_id TEXT REFERENCES providers(id),
    system_prompt TEXT,
    search_enabled INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    default_model_id TEXT REFERENCES models(id),
    default_provider_id TEXT REFERENCES providers(id),
    system_prompt_prefix TEXT,
    updated_at INTEGER NOT NULL
  );
`);

// ── Seed admin user ───────────────────────────────────────────────────────────

const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();

if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync(adminPassword, 12);
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)"
  ).run(id, adminUsername, passwordHash, Date.now());
  console.log(`Admin user created: ${adminUsername}`);
} else {
  console.log("Admin user already exists, skipping.");
}

// ── Seed default settings ─────────────────────────────────────────────────────

const defaults = [
  ["default_model", ""],
  ["default_provider", ""],
  ["system_prompt_template", "You are a helpful AI assistant."],
  ["max_history_messages", "20"],
  ["rate_limit_per_day", "0"],
  ["searxng_url", ""],
  ["searxng_enabled", "false"],
  ["searxng_username", ""],
  ["searxng_password", ""],
  ["searxng_default_language", "en"],
  ["searxng_safe_search", "0"],
  ["default_model_id", ""],
];

const upsert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [key, value] of defaults) {
  upsert.run(key, value);
}

db.close();
console.log("Database initialization complete.");
