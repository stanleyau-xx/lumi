import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { testSearXNGConnection } from "@/lib/searxng";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { url, username, password } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const result = await testSearXNGConnection(url, username, password);

  return NextResponse.json(result);
}
