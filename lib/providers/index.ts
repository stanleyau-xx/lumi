import { decrypt } from "@/lib/encryption";
import OpenAI from "openai";
import anthropic from "@anthropic-ai/sdk";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: any }>;
};

type Provider = {
  id: string;
  name: string;
  type: string;
  baseUrl: string | null;
  authMethod: string;
  apiKey: string | null;
  oauthAccessToken: string | null;
};

type Model = {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string | null;
  enabled: boolean;
};

type ChatOptions = {
  provider: Provider;
  model: Model;
  messages: ChatMessage[];
  stream?: boolean;
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  claude: "https://api.anthropic.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  minimax: "https://api.minimax.chat/v1",
  "minimax-cn": "https://api.minimax.chat/v1",
};

export async function getOpenAIClient(provider: Provider): Promise<OpenAI> {
  const baseURL = provider.baseUrl || DEFAULT_BASE_URLS[provider.type] || DEFAULT_BASE_URLS.openai;
  
  let apiKey: string | null = null;
  
  if (provider.apiKey) {
    try {
      apiKey = decrypt(provider.apiKey);
    } catch (e) {
      console.error("Failed to decrypt apiKey:", e);
    }
  }
  
  if (!apiKey && provider.oauthAccessToken) {
    try {
      apiKey = decrypt(provider.oauthAccessToken);
    } catch (e) {
      console.error("Failed to decrypt oauthAccessToken:", e);
    }
  }

  if (!apiKey) {
    throw new Error(`No API key configured for provider "${provider.name}". Please check Admin → Providers.`);
  }

  return new OpenAI({
    baseURL,
    apiKey,
  });
}

export async function getAnthropicClient(provider: Provider) {
  const baseURL = provider.baseUrl || DEFAULT_BASE_URLS.claude;
  const apiKey = provider.apiKey
    ? decrypt(provider.apiKey)
    : provider.oauthAccessToken
    ? decrypt(provider.oauthAccessToken)
    : null;

  if (!apiKey) {
    throw new Error(`No API key configured for provider "${provider.name}". Please check Admin → Providers.`);
  }

  return new anthropic.Anthropic({
    baseURL,
    apiKey,
  });
}

export async function streamChat(options: ChatOptions): Promise<ReadableStream> {
  const { provider, model, messages } = options;

  if (["openai", "openrouter", "minimax", "minimax-cn", "github", "github-copilot"].includes(provider.type)) {
    return streamOpenAICompatible(options);
  }

  if (provider.type === "claude") {
    return streamClaude(options);
  }

  throw new Error(`Unsupported provider type: ${provider.type}`);
}

async function streamOpenAICompatible(options: ChatOptions): Promise<ReadableStream> {
  const { provider, model, messages } = options;

  const client = await getOpenAIClient(provider);

  // Reasoning/thinking models (MiniMax M2.x, o1, o3, etc.) require max_tokens
  // and don't support temperature
  const isReasoningModel = /m2\.|o1|o3|thinking|reason/i.test(model.modelId);

  const response = await client.chat.completions.create({
    model: model.modelId,
    messages: messages as any[],
    stream: true,
    max_tokens: 40000,
    ...(!isReasoningModel && { temperature: 0.7 }),
  });

  return response.toReadableStream();
}

async function streamClaude(options: ChatOptions): Promise<ReadableStream> {
  const { provider, model, messages } = options;
  const client = await getAnthropicClient(provider) as any;

  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const stream = await client.messages.stream({
    model: model.modelId,
    system: systemMessage?.content,
    messages: nonSystemMessages as any[],
    max_tokens: 4096,
  });

  return stream.toReadableStream();
}

export async function testProviderConnection(provider: Provider): Promise<{ success: boolean; error?: string; models?: string[] }> {
  try {
    if (provider.type === "minimax" || provider.type === "minimax-cn") {
      return {
        success: true,
        models: getDefaultModelsForType(provider.type),
      };
    }

    if (provider.type === "openai" || provider.type === "openrouter") {
      const client = await getOpenAIClient(provider);
      const models = await client.models.list();
      return {
        success: true,
        models: models.data.map((m) => m.id),
      };
    }

    if (provider.type === "claude") {
      const client = await getAnthropicClient(provider) as any;
      const modelsResponse = await client.models.list();
      return {
        success: true,
        models: modelsResponse.data.map((m: any) => m.id || m.name),
      };
    }

    return { success: false, error: "Unknown provider type" };
  } catch (error: any) {
    return { success: false, error: error.message || "Connection failed" };
  }
}

function getDefaultModelsForType(type: string): string[] {
  const defaults: Record<string, string[]> = {
    "minimax": ["abab6-chat", "abab6-gomo"],
    "minimax-cn": ["Minimax-M2.7", "Minimax-M2.5"],
  };
  return defaults[type] || [];
}

export async function fetchProviderModels(provider: Provider): Promise<string[]> {
  const result = await testProviderConnection(provider);
  if (result.success && result.models) {
    return result.models;
  }
  throw new Error(result.error || "Failed to fetch models");
}
