import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type SearXNGConfig = {
  url: string;
  enabled: boolean;
  defaultLanguage: string;
  safeSearch: number;
  username: string;
  password: string;
};

function buildAuthHeaders(username: string, password: string): Record<string, string> {
  if (!username && !password) return {};
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

export async function getSearXNGConfig(): Promise<SearXNGConfig | null> {
  const settings = await Promise.all([
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_url") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_enabled") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_default_language") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_safe_search") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_username") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_password") }),
  ]);

  if (!settings[0]?.value) return null;

  return {
    url: settings[0].value,
    enabled: settings[1]?.value === "true",
    defaultLanguage: settings[2]?.value || "en",
    safeSearch: parseInt(settings[3]?.value || "0", 10),
    username: settings[4]?.value || "",
    password: settings[5]?.value || "",
  };
}

export async function search(query: string, engines: string[] = ["google", "bing", "duckduckgo"]): Promise<SearchResult[]> {
  const config = await getSearXNGConfig();

  if (!config || !config.enabled) {
    throw new Error("SearXNG is not configured or disabled");
  }

  const searxngUrl = config.url.replace(/\/$/, "");
  const params = new URLSearchParams({
    q: query,
    format: "json",
    engines: engines.join(","),
    lang: config.defaultLanguage,
    safe_search: config.safeSearch.toString(),
  });

  const response = await fetch(`${searxngUrl}/search?${params}`, {
    headers: {
      Accept: "application/json",
      ...buildAuthHeaders(config.username, config.password),
    },
  });

  if (!response.ok) {
    throw new Error(`SearXNG search failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.results) return [];

  return data.results.slice(0, 5).map((result: any) => ({
    title: result.title || "",
    url: result.url || "",
    snippet: result.content || result.description || "",
  }));
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "";

  const formatted = results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join("\n\n");

  return `REAL-TIME SEARCH RESULTS (retrieved just now):\n${formatted}\n\nINSTRUCTION: Use the search results above to answer the user's question directly with specific facts, numbers, and details from those results. Do NOT say you lack access to real-time data — the results above ARE real-time data.`;
}

export async function testSearXNGConnection(
  url: string,
  username = "",
  password = ""
): Promise<{ success: boolean; error?: string; results?: SearchResult[] }> {
  try {
    const cleanUrl = url.replace(/\/$/, "");
    const response = await fetch(`${cleanUrl}/search?q=test&format=json&engines=google&lang=en`, {
      headers: {
        Accept: "application/json",
        ...buildAuthHeaders(username, password),
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();

    if (!data.results) {
      return { success: false, error: "Invalid response format" };
    }

    const results: SearchResult[] = data.results.slice(0, 5).map((result: any) => ({
      title: result.title || "",
      url: result.url || "",
      snippet: result.content || result.description || "",
    }));

    return { success: true, results };
  } catch (error: any) {
    return { success: false, error: error.message || "Connection failed" };
  }
}
