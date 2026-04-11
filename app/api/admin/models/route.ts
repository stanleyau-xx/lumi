export const dynamic = 'force-dynamic'
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const models = db.select().from(schema.models).all();

  const modelsWithProviders = models.map((model) => {
    const provider = db.select().from(schema.providers)
      .where(eq(schema.providers.id, model.providerId))
      .get();
    return {
      ...model,
      provider,
    };
  });

  return NextResponse.json(modelsWithProviders);
}
