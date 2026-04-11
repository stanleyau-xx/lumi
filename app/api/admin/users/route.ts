export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = db.select().from(schema.users).all();

  return NextResponse.json(users.map((u) => ({ ...u, passwordHash: undefined })));
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { username, password, role, fullName } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const existing = db.select().from(schema.users)
    .where(eq(schema.users.username, username))
    .get();

  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 400 });
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);

  db.insert(schema.users).values({
    id,
    username,
    fullName: (fullName as string | undefined)?.trim() || username,
    passwordHash,
    role: role === "admin" ? "admin" : "user",
    createdAt: new Date(),
  }).run();

  const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();

  return NextResponse.json({ ...user, passwordHash: undefined });
}
