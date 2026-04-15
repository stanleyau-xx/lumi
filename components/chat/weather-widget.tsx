"use client";

import { useState, useEffect } from "react";
import { Wind, Droplets, Gauge, Sunrise, Sunset } from "lucide-react";

export type WeatherWidgetData = {
  location: string;
  current: {
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
  daily: Array<{
    date: string;
    high_C: number;
    low_C: number;
    high_F: number;
    low_F: number;
    desc: string;
    precipProb: number;
    sunrise: string;
    sunset: string;
  }>;
};

// Map WMO weather codes to icons and descriptions
type WeatherInfo = { icon: string; desc: string; gradient: string; darkGradient: string };

function getWeatherInfo(code: number, _isDay: boolean): WeatherInfo {
  const map: Record<number, WeatherInfo> = {
    0:  { icon: "☀️",  desc: "Clear",          gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",         darkGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" },
    1:  { icon: "🌤️", desc: "Mostly Clear",   gradient: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",           darkGradient: "linear-gradient(135deg, #2d3561 0%, #302b63 100%)" },
    2:  { icon: "⛅",  desc: "Partly Cloudy",  gradient: "linear-gradient(135deg, #b8c6db 0%, #f5f7fa 100%)",           darkGradient: "linear-gradient(135deg, #3d3d5c 0%, #2a2a4a 100%)" },
    3:  { icon: "☁️",  desc: "Cloudy",         gradient: "linear-gradient(135deg, #606c88 0%, #3f4c6b 100%)",           darkGradient: "linear-gradient(135deg, #2d3436 0%, #1e272e 100%)" },
    45: { icon: "🌫️", desc: "Fog",            gradient: "linear-gradient(135deg, #c9d6ff 0%, #e2e2e2 100%)",           darkGradient: "linear-gradient(135deg, #4a5568 0%, #2d3748 100%)" },
    48: { icon: "🌫️", desc: "Rime Fog",       gradient: "linear-gradient(135deg, #c9d6ff 0%, #e2e2e2 100%)",           darkGradient: "linear-gradient(135deg, #4a5568 0%, #2d3748 100%)" },
    51: { icon: "🌦️", desc: "Light Drizzle",   gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",           darkGradient: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)" },
    53: { icon: "🌧️", desc: "Drizzle",         gradient: "linear-gradient(135deg, #6dd5ed 0%, #2193b0 100%)",           darkGradient: "linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)" },
    55: { icon: "🌧️", desc: "Heavy Drizzle",   gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",           darkGradient: "linear-gradient(135deg, #0f2027 0%, #203a43 100%)" },
    61: { icon: "🌧️", desc: "Light Rain",      gradient: "linear-gradient(135deg, #6dd5ed 0%, #2193b0 100%)",           darkGradient: "linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)" },
    63: { icon: "🌧️", desc: "Rain",            gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",           darkGradient: "linear-gradient(135deg, #0f2027 0%, #203a43 100%)" },
    65: { icon: "⛈️", desc: "Heavy Rain",      gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)",          darkGradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)" },
    71: { icon: "🌨️", desc: "Light Snow",      gradient: "linear-gradient(135deg, #e6dada 0%, #274046 100%)",           darkGradient: "linear-gradient(135deg, #3d3d3d 0%, #1e272e 100%)" },
    73: { icon: "❄️",  desc: "Snow",            gradient: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",           darkGradient: "linear-gradient(135deg, #2d3436 0%, #1e272e 100%)" },
    75: { icon: "🌨️", desc: "Heavy Snow",      gradient: "linear-gradient(135deg, #d7d2cc 0%, #304352 100%)",           darkGradient: "linear-gradient(135deg, #1e272e 0%, #2d3436 100%)" },
    80: { icon: "🌦️", desc: "Light Showers",   gradient: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",          darkGradient: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)" },
    81: { icon: "🌧️", desc: "Showers",         gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",          darkGradient: "linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)" },
    82: { icon: "⛈️", desc: "Heavy Showers",   gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)",          darkGradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)" },
    95: { icon: "⛈️", desc: "Thunderstorm",    gradient: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)",          darkGradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)" },
    96: { icon: "⛈️", desc: "Thunder+Hail",    gradient: "linear-gradient(135deg, #1a1a2e 0%, #4a4e69 100%)",          darkGradient: "linear-gradient(135deg, #0f0c29 0%, #1a1a2e 100%)" },
    99: { icon: "⛈️", desc: "Severe Thunder",  gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)",          darkGradient: "linear-gradient(135deg, #0f0c29 0%, #1a1a2e 100%)" },
  };

  return map[code] ?? map[0]!;
}

function formatDay(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function WeatherWidget({ data }: { data: WeatherWidgetData }) {
  const isDark = useDarkMode();
  const { location, current, daily } = data;
  const isDay = current.isDay;
  const info = getWeatherInfo(
    // Estimate WMO code from description keywords as fallback
    current.desc.toLowerCase().includes("clear") ? 0 :
    current.desc.toLowerCase().includes("sunny") ? 0 :
    current.desc.toLowerCase().includes("partly") ? 2 :
    current.desc.toLowerCase().includes("cloud") ? 3 :
    current.desc.toLowerCase().includes("fog") ? 45 :
    current.desc.toLowerCase().includes("drizzle") ? 51 :
    current.desc.toLowerCase().includes("rain") ? 63 :
    current.desc.toLowerCase().includes("snow") ? 73 :
    current.desc.toLowerCase().includes("thunder") ? 95 : 0,
    isDay
  );

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg border border-border text-foreground w-full" style={{ background: isDark ? "#1a1a2e" : "#fff" }}>
      {/* Gradient header */}
      <div
        className="relative px-5 pt-5 pb-4"
        style={{ background: isDark ? info.darkGradient : info.gradient }}
      >
        <div className="flex items-start justify-between">
          {/* Current temp + icon */}
          <div className="flex items-center gap-3">
            <span className="text-5xl drop-shadow">{info.icon}</span>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white drop-shadow-lg">{current.temp_C}°</span>
                <span className="text-lg text-white/80">C</span>
              </div>
              <p className="text-sm font-medium text-white/90 drop-shadow mt-0.5">{info.desc}</p>
            </div>
          </div>

          {/* High/Low today */}
          <div className="text-right">
            <div className="flex items-center gap-1 text-white/90 text-sm">
              <span className="font-semibold">{daily[0]?.high_C ?? current.temp_C}°</span>
              <span className="text-white/60">/</span>
              <span className="text-white/60">{daily[0]?.low_C ?? current.temp_C}°</span>
            </div>
            <p className="text-xs text-white/70 mt-1">{location}</p>
          </div>
        </div>

        {/* Date line */}
        <p className="text-xs text-white/70 mt-3">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* 7-day forecast */}
      <div className="flex gap-2 px-5 py-4 overflow-x-auto min-h-[120px]">
        <div className="flex gap-2 flex-1 justify-between">
          {daily.slice(0, 7).map((day, i) => {
            const dayInfo = getWeatherInfo(
              day.desc.toLowerCase().includes("clear") ? 0 :
              day.desc.toLowerCase().includes("sunny") ? 0 :
              day.desc.toLowerCase().includes("partly") ? 2 :
              day.desc.toLowerCase().includes("cloud") ? 3 :
              day.desc.toLowerCase().includes("fog") ? 45 :
              day.desc.toLowerCase().includes("drizzle") ? 51 :
              day.desc.toLowerCase().includes("rain") ? 63 :
              day.desc.toLowerCase().includes("snow") ? 73 :
              day.desc.toLowerCase().includes("thunder") ? 95 : 0,
              true
            );
            return (
              <div key={i} className="flex flex-col items-center bg-muted/50 rounded-xl px-2 py-2 flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{formatDay(day.date)}</p>
                <span className="text-2xl drop-shadow-sm">{dayInfo.icon}</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="text-xs font-semibold">{day.high_C}°</span>
                  <span className="text-[10px] text-muted-foreground">/{day.low_C}°</span>
                </div>
                {day.precipProb > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <Droplets className="w-2.5 h-2.5 text-blue-400" />
                    <span className="text-[9px] text-muted-foreground">{day.precipProb}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-2 px-5 pb-5">
        <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5">
          <Wind className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Wind</p>
            <p className="text-xs font-semibold">{current.windKmph} km/h {current.windDir}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5">
          <Droplets className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Humidity</p>
            <p className="text-xs font-semibold">{current.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5">
          <Gauge className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Feels Like</p>
            <p className="text-xs font-semibold">{current.feelsLike_C}°C</p>
          </div>
        </div>
      </div>
    </div>
  );
}
