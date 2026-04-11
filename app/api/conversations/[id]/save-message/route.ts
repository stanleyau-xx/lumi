import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
