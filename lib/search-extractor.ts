import { streamChat, ChatMessage } from "./providers";

export type ClassifierResult = {
  skipSearch: boolean;
  personalSearch: boolean;
  academicSearch: boolean;
  discussionSearch: boolean;
  showWeatherWidget: boolean;
  showStockWidget: boolean;
  showCalculationWidget: boolean;
  standaloneFollowUp: string;
};

const CLASSIFIER_SYSTEM = `You are a search classifier. Analyze the user query and conversation history to determine how to handle it.

IMPORTANT: By "general knowledge" we mean ONLY information that is OBVIOUS, WIDELY KNOWN, and CANNOT HAVE CHANGED — for example: mathematical facts (2+2=4), basic scientific knowledge, common historical events, well-known facts that predate your training cutoff.

You MUST respond with ONLY valid JSON in this exact format — no explanation, no markdown, no extra text:
{
  "classification": {
    "skipSearch": boolean,
    "personalSearch": boolean,
    "academicSearch": boolean,
    "discussionSearch": boolean,
    "showWeatherWidget": boolean,
    "showStockWidget": boolean,
    "showCalculationWidget": boolean
  },
  "standaloneFollowUp": string
}

Label definitions — be VERY STRICT:
1. skipSearch: ONLY set true if the query is about OBVIOUS, UNCHANGING general knowledge — greetings, basic math, well-known historical facts that cannot have changed. Set it to FALSE if the query asks about: current policies, airline rules, company policies, laws, regulations, prices, availability, or anything that could have changed after your training data. **ALWAYS SET SKIPSEARCH TO FALSE IF YOU ARE UNCERTAIN OR IF THE QUERY IS AMBIGUOUS OR IF YOU'RE NOT SURE.**
2. personalSearch: Set true if the user explicitly asks about their uploaded documents or files.
3. academicSearch: Set true if the user explicitly asks for scholarly articles, research papers, or citations.
4. discussionSearch: Set true if the user asks for opinions, community discussions, forums, reviews, or personal experiences.
5. showWeatherWidget: ALWAYS set true if the user asks about weather in ANY way — "weather in London", "will it rain tomorrow", "show me weather", "is it sunny". The weather widget will fetch real-time data.
6. showStockWidget: ALWAYS set true if the user asks about stock prices, cryptocurrency prices, commodity prices, or exchange rates. The stock widget will fetch real-time data. Set skipSearch to FALSE as well when this is true.
7. showCalculationWidget: Set true if the user asks for mathematical calculations, conversions, or computations.
8. standaloneFollowUp: A self-contained reformulation of the query that can be understood without conversation history. Resolve pronouns (e.g., "what about that?" → "weather in Hong Kong"). Under 80 characters.`

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
  personalSearch: false,
  academicSearch: false,
  discussionSearch: false,
  showWeatherWidget: false,
  showStockWidget: false,
  showCalculationWidget: false,
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
      skipSearch: !!cls.skipSearch,
      personalSearch: !!cls.personalSearch,
      academicSearch: !!cls.academicSearch,
      discussionSearch: !!cls.discussionSearch,
      showWeatherWidget: !!cls.showWeatherWidget,
      showStockWidget: !!cls.showStockWidget,
      showCalculationWidget: !!cls.showCalculationWidget,
      standaloneFollowUp: (parsed.standaloneFollowUp ?? userMessage).slice(0, 200),
    };

    console.log("[Classifier] result:", result);
    return result;
  } catch (error) {
    console.error("[Classifier] failed:", error);
    return { ...FALLBACK_RESULT, standaloneFollowUp: userMessage };
  }
}
