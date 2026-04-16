export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import { getDefaultModels } from "@/lib/providers/defaults";
import { v4 as uuidv4 } from "uuid";

function validateBaseUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Base URL must use http or https";
    }
    return null;
  } catch {
    return "Base URL is not a valid URL";
  }
}

export async function GET() {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const providers = db.select().from(schema.providers).all();

  return NextResponse.json(providers);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    type,
    baseUrl,
    authMethod,
    apiKey,
    oauthClientId,
    oauthClientSecret,
    oauthTokenUrl,
    enabled,
  } = body;

  if (!name || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  if (baseUrl) {
    const urlError = validateBaseUrl(baseUrl);
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
  }

  const id = uuidv4();
  const now = new Date();

  db.insert(schema.providers).values({
    id,
    name,
    type,
    baseUrl: baseUrl || null,
    authMethod: authMethod || "api_key",
    apiKey: apiKey ? encrypt(apiKey) : null,
    oauthClientId: oauthClientId || null,
    oauthClientSecret: oauthClientSecret ? encrypt(oauthClientSecret) : null,
    oauthTokenUrl: oauthTokenUrl || null,
    enabled: enabled !== false,
    createdAt: now,
    updatedAt: now,
  }).run();

  const defaultModels = getDefaultModels(type);
  for (const modelId of defaultModels) {
    db.insert(schema.models).values({
      id: uuidv4(),
      providerId: id,
      modelId,
      displayName: modelId,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  const provider = db.select().from(schema.providers).where(eq(schema.providers.id, id)).get();

  return NextResponse.json(provider);
}
