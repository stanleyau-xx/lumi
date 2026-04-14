export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/encryption";

function safeDecrypt(value: string): string {
  if (!value) return "";
  try {
    return decrypt(value);
  } catch {
    // Value was stored unencrypted before this fix — return empty so admin re-enters it
    return "";
  }
}

export async function GET() {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const get = (key: string) =>
    db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();

  return NextResponse.json({
    url: get("searxng_url")?.value || "",
    enabled: get("searxng_enabled")?.value === "true",
    defaultLanguage: get("searxng_default_language")?.value || "en",
    safeSearch: parseInt(get("searxng_safe_search")?.value || "0", 10),
    username: safeDecrypt(get("searxng_username")?.value || ""),
    password: safeDecrypt(get("searxng_password")?.value || ""),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { url, enabled, defaultLanguage, safeSearch, username, password } = body;

  const upsert = (key: string, value: string) => {
    const existing = db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
    if (existing) {
      db.update(schema.settings).set({ value }).where(eq(schema.settings.key, key)).run();
    } else {
      db.insert(schema.settings).values({ key, value }).run();
    }
  };

  if (url !== undefined) upsert("searxng_url", url);
  if (enabled !== undefined) upsert("searxng_enabled", enabled ? "true" : "false");
  if (defaultLanguage !== undefined) upsert("searxng_default_language", defaultLanguage);
  if (safeSearch !== undefined) upsert("searxng_safe_search", safeSearch.toString());
  if (username !== undefined) upsert("searxng_username", username ? encrypt(username) : "");
  if (password !== undefined) upsert("searxng_password", password ? encrypt(password) : "");

  return NextResponse.json({ success: true });
}
