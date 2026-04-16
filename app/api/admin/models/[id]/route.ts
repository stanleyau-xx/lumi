import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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
  const { displayName, enabled } = body;

  const model = db.select().from(schema.models)
    .where(eq(schema.models.id, id))
    .get();

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  db.update(schema.models)
    .set({
      ...(displayName !== undefined && { displayName }),
      ...(enabled !== undefined && { enabled }),
      updatedAt: new Date(),
    })
    .where(eq(schema.models.id, id))
    .run();

  const updated = db.select().from(schema.models)
    .where(eq(schema.models.id, id))
    .get();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const model = db.select().from(schema.models)
    .where(eq(schema.models.id, id))
    .get();

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  // Nullify references before deleting to avoid FK constraint violations
  db.update(schema.conversations)
    .set({ modelId: null })
    .where(eq(schema.conversations.modelId, id))
    .run();

  db.update(schema.userSettings)
    .set({ defaultModelId: null })
    .where(eq(schema.userSettings.defaultModelId, id))
    .run();

  db.delete(schema.models)
    .where(eq(schema.models.id, id))
    .run();

  return NextResponse.json({ success: true });
}
