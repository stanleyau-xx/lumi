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

  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = db.select().from(schema.messages)
    .where(eq(schema.messages.conversationId, id))
    .orderBy(asc(schema.messages.createdAt))
    .all();

  return NextResponse.json(messages);
}
