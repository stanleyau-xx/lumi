/**
 * Schedules daily prompt generation at 5:00 AM (server local time).
 * Called once from instrumentation.ts on Node.js server startup.
 */

import { generateDailyPrompts } from "./prompt-generator";

/** Returns milliseconds until the next occurrence of the given hour (0-23). */
function msUntilHour(targetHour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // already past today → tomorrow
  return next.getTime() - now.getTime();
}

/** Generate now if no prompts stored yet (first ever run), then schedule at 5 AM daily. */
export async function schedulePromptGeneration(): Promise<void> {
  // Lazy import db to avoid issues during Next.js build/compilation
  const { db, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");

  const existing = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "daily_prompts"))
    .get();

  if (!existing) {
    // No prompts yet — generate immediately so the page has something to show
    console.log("[prompt-scheduler] No prompts found on startup — generating now.");
    await generateDailyPrompts();
  }

  // Schedule next run at 5 AM
  const msToFive = msUntilHour(5);
  console.log(
    `[prompt-scheduler] Next generation scheduled in ${Math.round(msToFive / 60000)} min ` +
    `(at ${new Date(Date.now() + msToFive).toLocaleTimeString()}).`
  );

  setTimeout(function tick() {
    generateDailyPrompts().catch((err) =>
      console.error("[prompt-scheduler] Generation failed:", err)
    );
    // Reschedule 24 h later
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, msToFive);
}
