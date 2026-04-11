import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

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
  const { username, password, role } = body;

  const user = db.select().from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (username) {
    const existing = db.select().from(schema.users)
      .where(eq(schema.users.username, username))
      .get();

    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }
  }

  let passwordHash: string | undefined;
  if (password) {
    passwordHash = await bcrypt.hash(password, 12);
  }

  db.update(schema.users)
    .set({
      ...(username && { username }),
      ...(passwordHash && { passwordHash }),
      ...(role && { role }),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, id))
    .run();

  const updated = db.select().from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  return NextResponse.json({ ...updated, passwordHash: undefined });
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

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const user = db.select().from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  db.delete(schema.users)
    .where(eq(schema.users.id, id))
    .run();

  return NextResponse.json({ success: true });
}
