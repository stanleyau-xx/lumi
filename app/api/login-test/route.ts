export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    console.log("Direct login attempt:", username);

    const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    console.log("Password valid:", isValid);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
