export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userSettings = db.select().from(schema.userSettings)
    .where(eq(schema.userSettings.userId, session.user.id))
    .get();

  // Global admin default as fallback
  const globalDefault = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "default_model_id"))
    .get();

  return NextResponse.json({
    defaultModelId: userSettings?.defaultModelId ?? null,
    defaultProviderId: userSettings?.defaultProviderId ?? null,
    systemPromptPrefix: userSettings?.systemPromptPrefix ?? null,
    globalDefaultModelId: globalDefault?.value ?? null,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { defaultModelId, defaultProviderId, systemPromptPrefix } = body;

  const existing = db.select().from(schema.userSettings)
    .where(eq(schema.userSettings.userId, session.user.id))
    .get();

  if (existing) {
    db.update(schema.userSettings)
      .set({
        ...(defaultModelId !== undefined && { defaultModelId }),
        ...(defaultProviderId !== undefined && { defaultProviderId }),
        ...(systemPromptPrefix !== undefined && { systemPromptPrefix }),
        updatedAt: new Date(),
      })
      .where(eq(schema.userSettings.id, existing.id))
      .run();
  } else {
    db.insert(schema.userSettings).values({
      id: uuidv4(),
      userId: session.user.id,
      defaultModelId: defaultModelId || null,
      defaultProviderId: defaultProviderId || null,
      systemPromptPrefix: systemPromptPrefix || null,
      updatedAt: new Date(),
    }).run();
  }

  const updated = db.select().from(schema.userSettings)
    .where(eq(schema.userSettings.userId, session.user.id))
    .get();

  return NextResponse.json(updated);
}
