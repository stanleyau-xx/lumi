import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1$|fc00:|fe80:)/i;

function validateBaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Base URL must use http or https";
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || PRIVATE_IP_RE.test(host)) {
      return "Base URL must not point to a private or internal address";
    }
    return null;
  } catch {
    return "Base URL is not a valid URL";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const provider = db.select().from(schema.providers)
    .where(eq(schema.providers.id, id))
    .get();

  if (!provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(provider);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    baseUrl,
    authMethod,
    apiKey,
    oauthClientId,
    oauthClientSecret,
    oauthTokenUrl,
    enabled,
  } = body;

  const provider = db.select().from(schema.providers)
    .where(eq(schema.providers.id, id))
    .get();

  if (!provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (baseUrl) {
    const urlError = validateBaseUrl(baseUrl);
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
  }

  db.update(schema.providers)
    .set({
      ...(name !== undefined && { name }),
      ...(baseUrl !== undefined && { baseUrl }),
      ...(authMethod !== undefined && { authMethod }),
      ...(apiKey !== undefined && { apiKey: apiKey ? encrypt(apiKey) : null }),
      ...(oauthClientId !== undefined && { oauthClientId }),
      ...(oauthClientSecret !== undefined && { oauthClientSecret: oauthClientSecret ? encrypt(oauthClientSecret) : null }),
      ...(oauthTokenUrl !== undefined && { oauthTokenUrl }),
      ...(enabled !== undefined && { enabled }),
      updatedAt: new Date(),
    })
    .where(eq(schema.providers.id, id))
    .run();

  const updated = db.select().from(schema.providers)
    .where(eq(schema.providers.id, id))
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();

    if (!session?.user || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const provider = db.select().from(schema.providers)
      .where(eq(schema.providers.id, id))
      .get();

    if (!provider) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Null out userSettings that reference this provider or its models
    db.update(schema.userSettings)
      .set({ defaultProviderId: null })
      .where(eq(schema.userSettings.defaultProviderId, id))
      .run();

    const providerModels = db.select().from(schema.models)
      .where(eq(schema.models.providerId, id))
      .all();

    for (const m of providerModels) {
      db.update(schema.userSettings)
        .set({ defaultModelId: null })
        .where(eq(schema.userSettings.defaultModelId, m.id))
        .run();

      db.update(schema.conversations)
        .set({ modelId: null })
        .where(eq(schema.conversations.modelId, m.id))
        .run();
    }

    db.update(schema.conversations)
      .set({ providerId: null })
      .where(eq(schema.conversations.providerId, id))
      .run();

    db.delete(schema.models)
      .where(eq(schema.models.providerId, id))
      .run();

    db.delete(schema.providers)
      .where(eq(schema.providers.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE provider error:", error);
    return NextResponse.json({ error: error.message || "Delete failed" }, { status: 500 });
  }
}
