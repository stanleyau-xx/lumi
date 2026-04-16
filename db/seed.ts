import { db, schema } from "./index";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

async function runMigrations() {
  console.log("Running database migrations...");
  migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations complete.");
}

async function seedAdminUser() {
  const existingAdmin = db.query.users.findFirst({
    where: (users, { eq }) => eq(users.role, "admin"),
  });

  if (!existingAdmin) {
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    db.insert(schema.users).values({
      id: uuidv4(),
      username: adminUsername,
      passwordHash,
      role: "admin",
      createdAt: new Date(),
    }).run();

    console.log(`Admin user created: ${adminUsername}`);
  }
}

async function seedDefaultSettings() {
  const defaultSettings = [
    { key: "default_model", value: "" },
    { key: "default_provider", value: "" },
    { key: "system_prompt_template", value: "You are a helpful AI assistant." },
    { key: "max_history_messages", value: "20" },
    { key: "rate_limit_per_day", value: "0" },
    { key: "searxng_url", value: "" },
    { key: "searxng_enabled", value: "false" },
    { key: "searxng_default_language", value: "en" },
    { key: "searxng_safe_search", value: "0" },
  ];

  for (const setting of defaultSettings) {
    const existing = db.query.settings.findFirst({
      where: (settings, { eq }) => eq(settings.key, setting.key),
    });

    if (!existing) {
      db.insert(schema.settings).values(setting).run();
    }
  }
}

export async function initializeDatabase() {
  try {
    await runMigrations();
    await seedAdminUser();
    await seedDefaultSettings();
    console.log("Database initialization complete.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}
