import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
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

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = db.select().from(schema.messages)
    .where(eq(schema.messages.conversationId, id))
    .orderBy(asc(schema.messages.createdAt))
    .all();

  return NextResponse.json(messages);
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

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  // Delete the message and all its descendants recursively
  const collectDescendants = (parentId: string): string[] => {
    const children = db.select().from(schema.messages)
      .where(eq(schema.messages.parentId, parentId)).all();
    let ids: string[] = [];
    for (const child of children) {
      ids = ids.concat(collectDescendants(child.id));
    }
    return [parentId, ...ids];
  };
  const idsToDelete = collectDescendants(messageId);
  for (const mid of idsToDelete) {
    db.delete(schema.messages).where(eq(schema.messages.id, mid)).run();
  }

  // Remove deleted messages from conversation active_branches
  const conv = db.select().from(schema.conversations).where(eq(schema.conversations.id, id)).get();
  if (conv?.activeBranches) {
    try {
      const branches = JSON.parse(conv.activeBranches);
      const cleaned = Object.fromEntries(
        Object.entries(branches).filter(([_, v]) => !idsToDelete.includes(v as string))
      );
      db.update(schema.conversations).set({ activeBranches: JSON.stringify(cleaned) })
        .where(eq(schema.conversations.id, id)).run();
    } catch {}
  }

  return NextResponse.json({ success: true });
}
