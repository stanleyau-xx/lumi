import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { fetchProviderModels } from "@/lib/providers";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { providerId, manualModelIds } = body;

  if (!providerId) {
    return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
  }

  const provider = db.select().from(schema.providers)
    .where(eq(schema.providers.id, providerId))
    .get();

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  try {
    const models = manualModelIds?.length ? manualModelIds : await fetchProviderModels(provider);
    const now = new Date();
    const addedModels = [];

    for (const modelId of models) {
      const existing = db.select().from(schema.models)
        .where(and(eq(schema.models.providerId, providerId), eq(schema.models.modelId, modelId)))
        .get();

      if (!existing) {
        const id = uuidv4();
        db.insert(schema.models).values({
          id,
          providerId,
          modelId,
          displayName: modelId,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        }).run();
        addedModels.push({ id, modelId, displayName: modelId });
      }
    }

    return NextResponse.json({
      success: true,
      fetched: models.length,
      added: addedModels,
    });
  } catch (error: any) {
    console.error("Fetch models error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch models" }, { status: 500 });
  }
}
