/**
 * Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
 * Used to initialise background tasks such as the daily prompt scheduler.
 */
export async function register() {
  // Skip during `next build` — the DB doesn't exist yet and concurrent access
  // from multiple build workers causes SQLITE_BUSY errors.
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { schedulePromptGeneration } = await import("./lib/prompt-scheduler");
    schedulePromptGeneration().catch((err) =>
      console.error("[instrumentation] Scheduler init failed:", err)
    );
  }
}
