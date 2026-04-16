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
  const fileSizeLimitMB = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "file_size_limit_mb"))
    .get();
  const fileSizeLimitPdfMB = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "file_size_limit_pdf_mb"))
    .get();
  const fileSizeLimitSheetMB = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "file_size_limit_sheet_mb"))
    .get();

  return NextResponse.json({
    defaultModel: defaultModel?.value || "",
    defaultProvider: defaultProvider?.value || "",
    defaultModelId: defaultModelId?.value || null,
    systemPromptTemplate: systemPromptTemplate?.value || "",
    maxHistoryMessages: parseInt(maxHistoryMessages?.value || "20", 10),
    rateLimitPerDay: parseInt(rateLimitPerDay?.value || "0", 10),
    fileSizeLimitMB: parseInt(fileSizeLimitMB?.value || "10", 10),
    fileSizeLimitPdfMB: parseInt(fileSizeLimitPdfMB?.value || "20", 10),
    fileSizeLimitSheetMB: parseInt(fileSizeLimitSheetMB?.value || "10", 10),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { defaultModel, defaultProvider, defaultModelId, systemPromptTemplate, maxHistoryMessages, rateLimitPerDay, fileSizeLimitMB, fileSizeLimitPdfMB, fileSizeLimitSheetMB } = body;

  const upsertSetting = (key: string, value: string | null | undefined) => {
    const strValue = (value == null ? "" : String(value));
    const existing = db.select().from(schema.settings)
      .where(eq(schema.settings.key, key))
      .get();

    if (existing) {
      db.update(schema.settings)
        .set({ value: strValue })
        .where(eq(schema.settings.key, key))
        .run();
    } else {
      db.insert(schema.settings).values({ key, value: strValue }).run();
    }
  };

  if (defaultModel !== undefined) upsertSetting("default_model", defaultModel);
  if (defaultProvider !== undefined) upsertSetting("default_provider", defaultProvider);
  if (defaultModelId !== undefined) upsertSetting("default_model_id", defaultModelId);
  if (systemPromptTemplate !== undefined) upsertSetting("system_prompt_template", systemPromptTemplate);
  if (maxHistoryMessages !== undefined) upsertSetting("max_history_messages", maxHistoryMessages.toString());
  if (rateLimitPerDay !== undefined) upsertSetting("rate_limit_per_day", rateLimitPerDay.toString());
  if (fileSizeLimitMB !== undefined) {
    const clamped = Math.min(Math.max(parseInt(fileSizeLimitMB, 10) || 10, 1), 100);
    upsertSetting("file_size_limit_mb", clamped.toString());
  }
  if (fileSizeLimitPdfMB !== undefined) {
    const clamped = Math.min(Math.max(parseInt(fileSizeLimitPdfMB, 10) || 20, 1), 100);
    upsertSetting("file_size_limit_pdf_mb", clamped.toString());
  }
  if (fileSizeLimitSheetMB !== undefined) {
    const clamped = Math.min(Math.max(parseInt(fileSizeLimitSheetMB, 10) || 10, 1), 100);
    upsertSetting("file_size_limit_sheet_mb", clamped.toString());
  }

  return NextResponse.json({
    defaultModel: defaultModel || "",
    defaultProvider: defaultProvider || "",
    systemPromptTemplate: systemPromptTemplate || "",
    maxHistoryMessages: maxHistoryMessages || 20,
    rateLimitPerDay: rateLimitPerDay || 0,
    fileSizeLimitMB: fileSizeLimitMB || 10,
    fileSizeLimitPdfMB: fileSizeLimitPdfMB || 20,
    fileSizeLimitSheetMB: fileSizeLimitSheetMB || 10,
  });
}
