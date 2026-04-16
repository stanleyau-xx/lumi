export const dynamic = 'force-dynamic'
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const FALLBACK_PROMPTS = [
  "Help me write a Python function to sort a list",
  "Explain quantum computing in simple terms",
  "Write a creative short story about a robot",
  "Help me debug this code I wrote",
  "What are the most fascinating unsolved problems in mathematics?",
  "Explain the concept of recursion using a real-world analogy",
];

/** Pick `n` random items from an array without repeats. */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function GET() {
  try {
    const row = db.select().from(schema.settings)
      .where(eq(schema.settings.key, "daily_prompts"))
      .get();

    if (row?.value) {
      const all: string[] = JSON.parse(row.value);
      if (all.length >= 4) {
        return NextResponse.json({ prompts: pickRandom(all, 4) });
      }
    }
  } catch (err) {
    console.error("[api/prompts] Failed to load stored prompts:", err);
  }

  // Fall back to a random selection from hardcoded list
  return NextResponse.json({ prompts: pickRandom(FALLBACK_PROMPTS, 4) });
}
