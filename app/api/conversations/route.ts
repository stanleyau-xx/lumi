export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { touchLastActive } from "@/lib/touch-last-active";
import { eq, desc, like, or, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  touchLastActive(session.user.id);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (q) {
    // Search by title
    const byTitle = db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.userId, session.user.id),
        like(schema.conversations.title, `%${q}%`)
      ))
      .orderBy(desc(schema.conversations.updatedAt))
      .all();

    // Search by message content — get matching conversation IDs
    const matchingMsgs = db.select({ conversationId: schema.messages.conversationId })
      .from(schema.messages)
      .where(like(schema.messages.content, `%${q}%`))
      .all();

    const matchingIds = [...new Set(matchingMsgs.map((m) => m.conversationId))];

    // Fetch those conversations that belong to this user
    const byContent = matchingIds.length > 0
      ? db.select().from(schema.conversations)
          .where(and(
            eq(schema.conversations.userId, session.user.id),
            inArray(schema.conversations.id, matchingIds)
          ))
          .orderBy(desc(schema.conversations.updatedAt))
          .all()
      : [];

    // Merge and deduplicate
    const seen = new Set(byTitle.map((c) => c.id));
    const merged = [...byTitle, ...byContent.filter((c) => !seen.has(c.id))];
    merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json(merged);
  }

  const conversations = db.select().from(schema.conversations)
    .where(eq(schema.conversations.userId, session.user.id))
    .orderBy(desc(schema.conversations.updatedAt))
    .all();

  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { providerId, modelId, systemPrompt, searchEnabled } = body;

  const id = uuidv4();
  const now = new Date();

  db.insert(schema.conversations).values({
    id,
    userId: session.user.id,
    title: "New Conversation",
    providerId: providerId || null,
    modelId: modelId || null,
    systemPrompt: systemPrompt || null,
    searchEnabled: searchEnabled || false,
    createdAt: now,
    updatedAt: now,
  }).run();

  const conversation = db.select().from(schema.conversations).where(eq(schema.conversations.id, id)).get();

  return NextResponse.json(conversation);
}
