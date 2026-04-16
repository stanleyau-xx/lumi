import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Stamps `last_login_at` (semantically "last active") for the given user.
 * Only writes to the DB if more than 5 minutes have passed since the last
 * update — avoids a DB write on every single API request.
 */
export function touchLastActive(userId: string): void {
  try {
    const user = db
      .select({ lastActiveAt: schema.users.lastActiveAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();

    const now = new Date();
    if (
      !user?.lastActiveAt ||
      now.getTime() - new Date(user.lastActiveAt).getTime() > DEBOUNCE_MS
    ) {
      db.update(schema.users)
        .set({ lastActiveAt: now })
        .where(eq(schema.users.id, userId))
        .run();
    }
  } catch {
    // Non-critical — never let this break the actual request
  }
}
