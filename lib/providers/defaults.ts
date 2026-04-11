const DEFAULT_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  claude: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  openrouter: ["openai/gpt-4o", "openai/gpt-4-turbo", "anthropic/claude-3-opus", "anthropic/claude-3-sonnet"],
  minimax: ["abab6-chat", "abab6-gomo"],
  "minimax-cn": ["Minimax-M2.7", "Minimax-M2.5"],
};

export function getDefaultModels(providerType: string): string[] {
  return DEFAULT_MODELS[providerType] || [];
}
