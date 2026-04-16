"use client";

import { useEffect, useRef } from "react";

interface CryptoChartProps {
  symbol: string; // e.g. "BTC", "ETH"
}

export function CryptoChart({ symbol }: CryptoChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    container.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: `BINANCE:${symbol}USDT`,
      width: "100%",
      height: 220,
      locale: "en",
      dateRange: "1M",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
      noTimeScale: false,
    });
    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div
      className="tradingview-widget-container mb-3 rounded-xl overflow-hidden"
      ref={containerRef}
      style={{ minHeight: 220 }}
    />
  );
}
