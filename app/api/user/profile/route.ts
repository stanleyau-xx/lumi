export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = db.select().from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName ?? user.username,
    role: user.role,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { fullName } = body;

  if (typeof fullName !== "string" || fullName.trim().length === 0) {
    return NextResponse.json({ error: "Full name cannot be empty" }, { status: 400 });
  }

  db.update(schema.users)
    .set({ fullName: fullName.trim() })
    .where(eq(schema.users.id, session.user.id))
    .run();

  const updated = db.select().from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .get();

  return NextResponse.json({
    id: updated!.id,
    username: updated!.username,
    fullName: updated!.fullName ?? updated!.username,
    role: updated!.role,
  });
}
