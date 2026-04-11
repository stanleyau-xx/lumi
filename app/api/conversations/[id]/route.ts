export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = db.select().from(schema.conversations)
    .where(eq(schema.conversations.id, id))
    .get();

  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, modelId, providerId, systemPrompt, searchEnabled, activeBranches } = body;

  const conversation = db.select().from(schema.conversations)
    .where(eq(schema.conversations.id, id))
    .get();

  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.update(schema.conversations)
    .set({
      ...(title !== undefined && { title }),
      ...(modelId !== undefined && { modelId }),
      ...(providerId !== undefined && { providerId }),
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(searchEnabled !== undefined && { searchEnabled }),
      ...(activeBranches !== undefined && { activeBranches: JSON.stringify(activeBranches) }),
      updatedAt: new Date(),
    })
    .where(eq(schema.conversations.id, id))
    .run();

  const updated = db.select().from(schema.conversations).where(eq(schema.conversations.id, id)).get();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = db.select().from(schema.conversations)
    .where(eq(schema.conversations.id, id))
    .get();

  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.delete(schema.conversations)
    .where(eq(schema.conversations.id, id))
    .run();

  return NextResponse.json({ success: true });
}
