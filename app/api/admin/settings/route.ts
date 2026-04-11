export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const defaultModel = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "default_model"))
    .get();
  const defaultProvider = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "default_provider"))
    .get();
  const defaultModelId = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "default_model_id"))
    .get();
  const systemPromptTemplate = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "system_prompt_template"))
    .get();
  const maxHistoryMessages = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "max_history_messages"))
    .get();
  const rateLimitPerDay = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "rate_limit_per_day"))
    .get();

  return NextResponse.json({
    defaultModel: defaultModel?.value || "",
    defaultProvider: defaultProvider?.value || "",
    defaultModelId: defaultModelId?.value || null,
    systemPromptTemplate: systemPromptTemplate?.value || "",
    maxHistoryMessages: parseInt(maxHistoryMessages?.value || "20", 10),
    rateLimitPerDay: parseInt(rateLimitPerDay?.value || "0", 10),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { defaultModel, defaultProvider, defaultModelId, systemPromptTemplate, maxHistoryMessages, rateLimitPerDay } = body;

  const upsertSetting = (key: string, value: string) => {
    const existing = db.select().from(schema.settings)
      .where(eq(schema.settings.key, key))
      .get();

    if (existing) {
      db.update(schema.settings)
        .set({ value })
        .where(eq(schema.settings.key, key))
        .run();
    } else {
      db.insert(schema.settings).values({ key, value }).run();
    }
  };

  if (defaultModel !== undefined) upsertSetting("default_model", defaultModel);
  if (defaultProvider !== undefined) upsertSetting("default_provider", defaultProvider);
  if (defaultModelId !== undefined) upsertSetting("default_model_id", defaultModelId);
  if (systemPromptTemplate !== undefined) upsertSetting("system_prompt_template", systemPromptTemplate);
  if (maxHistoryMessages !== undefined) upsertSetting("max_history_messages", maxHistoryMessages.toString());
  if (rateLimitPerDay !== undefined) upsertSetting("rate_limit_per_day", rateLimitPerDay.toString());

  return NextResponse.json({
    defaultModel: defaultModel || "",
    defaultProvider: defaultProvider || "",
    systemPromptTemplate: systemPromptTemplate || "",
    maxHistoryMessages: maxHistoryMessages || 20,
    rateLimitPerDay: rateLimitPerDay || 0,
  });
}
