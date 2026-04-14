/**
 * Real-time weather via wttr.in — no API key required.
 */

export function extractWeatherLocation(query: string): string | null {
  if (!/^weather\b/i.test(query.trim())) return null;

  const location = query
    .replace(/^weather\s+/i, "")
    .replace(/\s+(today|tomorrow|now|tonight|this week|weekly|hourly|current|live|forecast)[\s?]*$/i, "")
    .trim();

  return location || null;
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
      `- Temperature: ${cur.temp_C}°C (${cur.temp_F}°F)`,
      `- Feels like:  ${cur.FeelsLikeC}°C (${cur.FeelsLikeF}°F)`,
      `- Humidity:    ${cur.humidity}%`,
      `- Wind:        ${cur.windspeedKmph} km/h ${cur.winddir16Point}`,
      `- Visibility:  ${cur.visibility} km`,
      `- UV index:    ${cur.uvIndex}`,
    ];

    // Today's forecast high/low
    const today = data.weather?.[0];
    if (today) {
      lines.push(`- Today high:  ${today.maxtempC}°C  /  low: ${today.mintempC}°C`);
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
