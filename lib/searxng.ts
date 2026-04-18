import { db, schema } from "@/db";
import { lookup } from "node:dns/promises";

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
};

export async function getSearXNGConfig(): Promise<SearXNGConfig | null> {
  const settings = await Promise.all([
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_url") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_enabled") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_default_language") }),
    db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, "searxng_safe_search") }),
  ]);

  if (!settings[0]?.value) return null;

  return {
    url: settings[0].value,
    enabled: settings[1]?.value === "true",
    defaultLanguage: settings[2]?.value || "en",
    safeSearch: parseInt(settings[3]?.value || "0", 10),
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
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`SearXNG search failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.results) return [];

  return data.results.slice(0, 50).map((result: any) => ({
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

  return `<context>
${formatted}
</context>

INSTRUCTION: You are Vane, an AI model skilled in web search and crafting detailed, engaging, and well-structured answers. Provide responses that are informative, well-structured with clear headings. Every number or price you show should appear only ONCE — never repeat duplicates in tables or lists. If sources show different prices for the same item, pick the most reliable source and use that single price only. Do not create tables with repeated/duplicate values like "X-Y-Z" where Y equals X.`;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isIpLiteral(hostname: string): { isIp: boolean; blocked: boolean } {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { isIp: true, blocked: isPrivateIPv4(hostname) };
  }
  if (hostname.includes(":")) {
    return { isIp: true, blocked: isPrivateIPv6(hostname) };
  }
  return { isIp: false, blocked: false };
}

async function isBlockedHost(hostname: string): Promise<boolean> {
  const literalCheck = isIpLiteral(hostname);
  if (literalCheck.isIp) return literalCheck.blocked;

  try {
    const records = await lookup(hostname, { all: true });
    if (!records.length) return true;

    return records.some((r) =>
      r.family === 4 ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address)
    );
  } catch {
    return true;
  }
}

export async function testSearXNGConnection(
  url: string
): Promise<{ success: boolean; error?: string; results?: SearchResult[] }> {
  try {
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return { success: false, error: "Invalid URL format" };
    }

    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { success: false, error: "Only HTTP and HTTPS protocols are allowed" };
    }

    if (urlObj.username || urlObj.password) {
      return { success: false, error: "URLs with credentials are not allowed" };
    }

    if (await isBlockedHost(urlObj.hostname)) {
      return { success: false, error: "Target host is not allowed" };
    }

    const searchUrl = new URL("/search", urlObj);
    searchUrl.searchParams.set("q", "test");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("engines", "google");
    searchUrl.searchParams.set("lang", "en");

    const response = await fetch(searchUrl.toString(), {
      headers: { Accept: "application/json" },
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