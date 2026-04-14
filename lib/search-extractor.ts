import { streamChat, ChatMessage } from "./providers";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

function buildExtractionPrompt(): string {
  const today = new Date().toISOString().split("T")[0]; // e.g. 2026-04-14
  return `Today's date is ${today}. Decide whether this message needs a real-time internet search.

Return "NO_SEARCH" if the message is: a greeting, casual conversation, general knowledge, coding help, explanations, math, writing, or anything answerable without current data.

Return ONLY the search query (under 80 characters) if the message requires real-time or recent information: weather, news, sports scores, stock/crypto prices, live events, recent product releases, current people/roles, or anything where the answer may have changed since mid-2025.

Examples:
"How are you?" → NO_SEARCH
"What is Python?" → NO_SEARCH
"Write me a poem" → NO_SEARCH
"Help me fix this code" → NO_SEARCH
"What's the weather in Hong Kong tomorrow?" → weather Hong Kong tomorrow forecast
"Latest iPhone release" → latest iPhone release 2026
"Bitcoin price" → Bitcoin price ${today}
"Who is the US president?" → US president ${today}

User message: `;
}

export async function extractSearchQuery(
  userMessage: string,
  provider: any,
  model: any
): Promise<string | null> {
  if (!userMessage || userMessage.trim().length < 10) {
    return null;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "You are a search classifier. Return ONLY the search query or 'NO_SEARCH'. No explanations, no formatting.",
    },
    {
      role: "user",
      content: `${buildExtractionPrompt()}"${userMessage}"`,
    },
  ];

  try {
    const stream = await streamChat({
      provider,
      model,
      messages,
      stream: true,
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let query = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const content = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text;
          if (content) query += content;
        } catch {
          // skip non-JSON lines
        }
      }
    }

    console.log("[Search extractor] raw query length:", query.length, "preview:", query.slice(0, 100));

    // Strip thinking blocks emitted by reasoning models
    query = query.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    query = query.replace(/^["']|["']$/g, "").trim();

    console.log("[Search extractor] cleaned query:", query);

    if (query === "NO_SEARCH" || query.length === 0) {
      return null;
    }

    if (query.length < 200) {
      return query;
    }

    console.log("[Search extractor] query rejected (length:", query.length, ")");
    return null;
  } catch (error) {
    console.error("[Search extractor] failed:", error);
    return null;
  }
}
