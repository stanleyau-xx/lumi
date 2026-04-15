/**
 * Real-time weather via wttr.in and Open-Meteo — no API key required.
 */

import { streamChat, ChatMessage } from "./providers";
import { Provider, Model } from "./providers";

export type WeatherCurrent = {
  temp_C: number;
  temp_F: number;
  desc: string;
  humidity: number;
  windKmph: number;
  windDir: string;
  feelsLike_C: number;
  feelsLike_F: number;
  uvIndex: string;
  visibility: string;
  isDay: boolean;
};

export type WeatherDaily = {
  date: string;
  high_C: number;
  low_C: number;
  high_F: number;
  low_F: number;
  desc: string;
  precipProb: number;
  sunrise: string;
  sunset: string;
};

export type WeatherStructured = {
  location: string;
  current: WeatherCurrent;
  daily: WeatherDaily[];
};

const LOCATION_EXTRACTOR_SYSTEM = `You are a location extractor for weather queries.

Analyze the user query and conversation history to determine the location they want weather for.

IMPORTANT: Always respond with ONLY valid JSON in this exact format — no explanation, no markdown, no extra text:
{
  "location": string,
  "notPresent": boolean
}

Rules:
- If the user is asking about weather, extract the location name in English (e.g., "London, UK", "Hong Kong", "New York City")
- Use full place names with country/region when helpful for disambiguation (e.g., "London, Ontario" vs "London, UK")
- Short forms: "NYC" -> "New York City", "HK" -> "Hong Kong", "Londres" -> "London"
- If the query is NOT about weather (e.g., "what is 2+2", "hello"), set notPresent to true
- If you cannot determine a valid location, set notPresent to true
- Do NOT guess coordinates — use place names only
- Location should be specific: city name + country/region for best weather results`;

function buildLocationUserMessage(userMessage: string, context: { role: string; content: string }[]): string {
  const historyBlock = context.length > 0
    ? `<conversation_history>\n${context.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")}\n</conversation_history>\n`
    : "";
  return `${historyBlock}<user_query>\n${userMessage}\n</user_query>`;
}

/**
 * LLM-based location extraction — handles any language (Chinese, English, etc.)
 * Mirrors Vane-MU's approach in weatherWidget.ts
 */
export async function extractWeatherLocation(
  userMessage: string,
  provider: Provider,
  model: Model,
  context: { role: string; content: string }[] = []
): Promise<{ location: string; notPresent: boolean }> {
  const messages: ChatMessage[] = [
    { role: "system", content: LOCATION_EXTRACTOR_SYSTEM },
    { role: "user", content: buildLocationUserMessage(userMessage, context) },
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

    // Extract JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Weather Location] no JSON found in LLM output:", raw.slice(0, 100));
      return { location: "", notPresent: true };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("[Weather Location] extracted:", parsed);
    return {
      location: (parsed.location ?? "").trim().slice(0, 200),
      notPresent: !!parsed.notPresent,
    };
  } catch (err) {
    console.error("[Weather Location] LLM extraction failed:", err);
    return { location: "", notPresent: true };
  }
}

export async function fetchWeather(location: string): Promise<string | null> {
  try {
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "curl/7.68.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const cur = data.current_condition?.[0];
    if (!cur) return null;

    const area  = data.nearest_area?.[0];
    const city    = area?.areaName?.[0]?.value  || location;
    const country = area?.country?.[0]?.value   || "";
    const desc    = cur.weatherDesc?.[0]?.value || "Unknown";

    const lines = [
      `Current weather in ${city}${country ? `, ${country}` : ""}:`,
      `- Condition:   ${desc}`,
      `- Temperature: ${cur.temp_C}°C`,
      `- Feels like:  ${cur.FeelsLikeC}°C`,
      `- Humidity:    ${cur.humidity}%`,
      `- Wind:        ${cur.windspeedKmph} km/h ${cur.winddir16Point}`,
      `- Visibility:  ${cur.visibility} km`,
      `- UV index:    ${cur.uvIndex}`,
    ];

    // 3-day forecast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const forecast: any[] = data.weather ?? [];
    if (forecast.length > 0) {
      lines.push(`\n3-day forecast:`);
      for (const day of forecast) {
        const date: string = day.date ?? "";
        const dayDesc: string = day.hourly?.[4]?.weatherDesc?.[0]?.value ?? day.hourly?.[0]?.weatherDesc?.[0]?.value ?? "";
        const sunrise: string = day.astronomy?.[0]?.sunrise ?? "";
        const sunset: string  = day.astronomy?.[0]?.sunset  ?? "";
        const astro = sunrise && sunset ? ` (sunrise ${sunrise}, sunset ${sunset})` : "";
        lines.push(`- ${date}: high ${day.maxtempC}°C / low ${day.mintempC}°C, ${dayDesc}${astro}`);
      }
    }

    return (
      `REAL-TIME WEATHER DATA (fetched just now):\n` +
      lines.join("\n") +
      `\n\nINSTRUCTION: Report the weather using the data above. State each fact once.`
    );
  } catch {
    return null;
  }
}

// WMO weather code descriptions
function wmoCodeDesc(code: number): string {
  const map: Record<number, string> = {
    0: "Clear", 1: "Mostly Clear", 2: "Partly Cloudy", 3: "Cloudy",
    45: "Fog", 48: "Rime Fog",
    51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
    61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
    71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
    77: "Snow Grains",
    80: "Light Showers", 81: "Showers", 82: "Heavy Showers",
    85: "Light Snow Showers", 86: "Snow Showers",
    95: "Thunderstorm", 96: "Thunder+Hail", 99: "Severe Thunderstorm",
  };
  return map[code] ?? "Unknown";
}

/**
 * Fetch structured weather data using Open-Meteo (free, no API key, returns WMO codes).
 * Falls back to wttr.in if Open-Meteo fails.
 */
export async function fetchWeatherStructured(location: string): Promise<WeatherStructured | null> {
  try {
    // Step 1: Geocode location via Nominatim
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
      { headers: { "User-Agent": "Lumi-AI/1.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!geoRes.ok) throw new Error("Geocoding failed");
    const geoData = await geoRes.json();
    if (!geoData?.[0]) {
      console.warn("[Weather] Location not found:", location);
      return null;
    }
    const { lat, lon, display_name } = geoData[0];
    const cityName = display_name.split(",")[0].trim();

    // Step 2: Fetch weather from Open-Meteo
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
        `&timezone=auto&forecast_days=7`,
      { headers: { "User-Agent": "Lumi-AI/1.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!weatherRes.ok) throw new Error("Open-Meteo request failed");
    const w = await weatherRes.json();
    const cur = w.current;
    const daily = w.daily;

    const current: WeatherCurrent = {
      temp_C: Math.round(cur.temperature_2m ?? 0),
      temp_F: Math.round((cur.temperature_2m ?? 0) * 9 / 5 + 32),
      desc: wmoCodeDesc(cur.weather_code ?? 0),
      humidity: Math.round(cur.relative_humidity_2m ?? 0),
      windKmph: Math.round(cur.wind_speed_10m ?? 0),
      windDir: cardinalDirection(cur.wind_direction_10m ?? 0),
      feelsLike_C: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
      feelsLike_F: Math.round((cur.apparent_temperature ?? cur.temperature_2m ?? 0) * 9 / 5 + 32),
      uvIndex: String(Math.round(cur.uv_index ?? 0)),
      visibility: "10", // Open-Meteo doesn't provide visibility in current forecast
      isDay: cur.is_day === 1,
    };

    const dailyData: WeatherDaily[] = (daily.time ?? []).slice(0, 7).map((t: string, i: number) => ({
      date: t,
      high_C: Math.round(daily.temperature_2m_max[i] ?? 0),
      low_C: Math.round(daily.temperature_2m_min[i] ?? 0),
      high_F: Math.round((daily.temperature_2m_max[i] ?? 0) * 9 / 5 + 32),
      low_F: Math.round((daily.temperature_2m_min[i] ?? 0) * 9 / 5 + 32),
      desc: wmoCodeDesc(daily.weather_code[i] ?? 0),
      precipProb: Math.round(daily.precipitation_probability_max[i] ?? 0),
      sunrise: daily.sunrise?.[i] ?? "",
      sunset: daily.sunset?.[i] ?? "",
    }));

    return { location: cityName, current, daily: dailyData };
  } catch (err) {
    console.error("[Weather] fetchWeatherStructured failed:", err);
    return null;
  }
}

function cardinalDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
