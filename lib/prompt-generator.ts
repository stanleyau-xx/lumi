/**
 * Generates 20 creative daily prompts using the default LLM and stores them
 * in the settings table (keys: "daily_prompts", "daily_prompts_date").
 *
 * Called by the instrumentation scheduler at 5 AM every day.
 */

import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOpenAIClient, getAnthropicClient } from "./providers";

// ── helpers ────────────────────────────────────────────────────────────────

function upsertSetting(key: string, value: string) {
  const existing = db.select().from(schema.settings)
    .where(eq(schema.settings.key, key))
    .get();
  if (existing) {
    db.update(schema.settings).set({ value }).where(eq(schema.settings.key, key)).run();
  } else {
    db.insert(schema.settings).values({ key, value }).run();
  }
}

async function getDefaultProviderAndModel() {
  // Respect the global default model setting if set
  const defaultModelSetting = db.select().from(schema.settings)
    .where(eq(schema.settings.key, "default_model_id"))
    .get();

  let model = defaultModelSetting?.value
    ? db.select().from(schema.models)
        .where(eq(schema.models.id, defaultModelSetting.value))
        .get()
    : null;

  // Fall back to first enabled model
  if (!model) {
    model = db.select().from(schema.models)
      .where(eq(schema.models.enabled, true))
      .get() ?? null;
  }

  if (!model) return null;

  const provider = db.select().from(schema.providers)
    .where(and(
      eq(schema.providers.id, model.providerId),
      eq(schema.providers.enabled, true),
    ))
    .get();

  if (!provider) return null;
  return { provider, model };
}

/** Non-streaming text completion — works with both OpenAI-compatible and Claude providers. */
async function generateText(
  provider: NonNullable<Awaited<ReturnType<typeof getDefaultProviderAndModel>>>["provider"],
  model: NonNullable<Awaited<ReturnType<typeof getDefaultProviderAndModel>>>["model"],
  userMessage: string,
): Promise<string> {
  if (provider.type === "claude") {
    const client = await getAnthropicClient(provider) as any;
    const response = await client.messages.create({
      model: model.modelId,
      max_tokens: 2048,
      messages: [{ role: "user", content: userMessage }],
    });
    return response.content?.[0]?.text ?? "";
  }

  // OpenAI-compatible
  const client = await getOpenAIClient(provider);
  const response = await client.chat.completions.create({
    model: model.modelId,
    max_tokens: 2048,
    temperature: 0.9,
    messages: [{ role: "user", content: userMessage }],
    stream: false,
  });
  return response.choices[0]?.message?.content ?? "";
}

// ── main export ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Generate exactly 20 creative, diverse, and interesting conversation starter prompts for an AI chat assistant.

Rules:
- Each prompt should be on its own line, numbered 1-20
- Cover a wide variety of topics: coding, writing, science, philosophy, creativity, productivity, fun, learning
- Make them engaging and specific — avoid generic requests like "tell me a joke"
- Each prompt should be 5–15 words long
- Return ONLY the numbered list, no extra commentary

Example format:
1. Explain the butterfly effect using a real historical example
2. Write a haiku about debugging at 2 AM
...`;

export async function generateDailyPrompts(): Promise<void> {
  console.log("[prompt-generator] Starting daily prompt generation…");

  const pair = await getDefaultProviderAndModel();
  if (!pair) {
    console.warn("[prompt-generator] No enabled provider/model found — skipping.");
    return;
  }

  const { provider, model } = pair;
  console.log(`[prompt-generator] Using ${provider.name} / ${model.modelId}`);

  let raw: string;
  try {
    raw = await generateText(provider, model, SYSTEM_PROMPT);
  } catch (err) {
    console.error("[prompt-generator] LLM call failed:", err);
    return;
  }

  // Parse numbered list: "1. Prompt text" → ["Prompt text", ...]
  const prompts = raw
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 20);

  if (prompts.length < 4) {
    console.warn("[prompt-generator] Too few prompts parsed, aborting save.");
    return;
  }

  upsertSetting("daily_prompts", JSON.stringify(prompts));
  upsertSetting("daily_prompts_date", new Date().toISOString());

  console.log(`[prompt-generator] Stored ${prompts.length} prompts.`);
}
