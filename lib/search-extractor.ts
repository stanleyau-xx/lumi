import { streamChat, ChatMessage } from "./providers";

export type ClassifierResult = {
  skipSearch: boolean;
  showWeatherWidget: boolean;
  showStockWidget: boolean;
  standaloneFollowUp: string;
};

const CLASSIFIER_SYSTEM = `You are a search classifier. Analyze the user query and conversation history to determine how to handle it.

You MUST respond with ONLY valid JSON in this exact format — no explanation, no markdown, no extra text:
{
  "classification": {
    "skipSearch": boolean,
    "showWeatherWidget": boolean,
    "showStockWidget": boolean
  },
  "standaloneFollowUp": string
}

Label definitions:
- skipSearch: Set true if the query can be fully answered from general knowledge (greetings, math, coding help, writing, explanations, historical facts). Set false if it needs real-time or recent information. DEFAULT TO FALSE WHEN UNCERTAIN.
- showWeatherWidget: Set true if the user is asking about weather or a forecast for a specific location (current or future). When true, also set skipSearch to true.
- showStockWidget: Set true if the user is asking about the current price of a cryptocurrency, stock, commodity, or exchange rate. When true, also set skipSearch to true.
- standaloneFollowUp: A self-contained, context-independent reformulation of the user's query. Use the conversation history to resolve pronouns and follow-ups. Example: if the prior topic was Hong Kong weather and the user says "what about next 7 days", write "weather Hong Kong 7 day forecast". Keep it concise (under 80 characters).`;

function buildUserMessage(
  userMessage: string,
  context: { role: string; content: string }[]
): string {
  const historyBlock =
    context.length > 0
      ? `<conversation_history>\n${context
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n")}\n</conversation_history>\n`
      : "";
  return `${historyBlock}<user_query>\n${userMessage}\n</user_query>`;
}

const FALLBACK_RESULT: ClassifierResult = {
  skipSearch: false,
  showWeatherWidget: false,
  showStockWidget: false,
  standaloneFollowUp: "",
};

export async function classifyQuery(
  userMessage: string,
  provider: any,
  model: any,
  context: { role: string; content: string }[] = []
): Promise<ClassifierResult> {
  if (!userMessage || userMessage.trim().length < 3) {
    return { ...FALLBACK_RESULT, skipSearch: true, standaloneFollowUp: userMessage };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: CLASSIFIER_SYSTEM },
    { role: "user", content: buildUserMessage(userMessage, context) },
  ];

  try {
    const stream = await streamChat({ provider, model, messages, stream: true });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let raw = "";
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
          if (content) raw += content;
        } catch {
          // skip non-JSON SSE lines
        }
      }
    }

    // Strip thinking blocks from reasoning models
    raw = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    console.log("[Classifier] raw output:", raw.slice(0, 200));

    // Extract JSON — handle markdown code fences if the model wraps it
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Classifier] no JSON found in output");
      return { ...FALLBACK_RESULT, standaloneFollowUp: userMessage };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const cls = parsed.classification ?? {};

    const result: ClassifierResult = {
      skipSearch:         !!cls.skipSearch,
      showWeatherWidget:  !!cls.showWeatherWidget,
      showStockWidget:    !!cls.showStockWidget,
      standaloneFollowUp: (parsed.standaloneFollowUp ?? userMessage).slice(0, 200),
    };

    console.log("[Classifier] result:", result);
    return result;
  } catch (error) {
    console.error("[Classifier] failed:", error);
    return { ...FALLBACK_RESULT, standaloneFollowUp: userMessage };
  }
}
