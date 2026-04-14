import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

export async function POST(
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

  try {
    const body = await request.json();
    const { content } = body;

    const assistantMessageId = uuidv4();
    const now = new Date();

    db.insert(schema.messages).values({
      id: assistantMessageId,
      conversationId: id,
      role: "assistant",
      content,
      createdAt: now,
    }).run();

    return NextResponse.json({ success: true, id: assistantMessageId });
  } catch (error: any) {
    console.error("Save message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
