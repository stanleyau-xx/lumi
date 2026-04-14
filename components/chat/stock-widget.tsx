"use client";

/**
 * Stock / crypto price widget.
 * Chart rendering ported from Vane (ItzCrazyKns/Vane) — MIT licence.
 * Uses lightweight-charts v5 + yahoo-finance2 data.
 */

import { useEffect, useRef, useState } from "react";
import { Clock, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { StockWidgetData } from "@/lib/stock-widget";

// ─── number formatters ────────────────────────────────────────────────────────

function fmt(n: number | undefined, decimals = 2): string {
  if (n == null) return "N/A";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtLarge(n: number | undefined): string {
  if (n == null) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

// ─── chart ────────────────────────────────────────────────────────────────────

type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y" | "MAX";

function Chart({
  data,
  selectedTimeframe,
  isDark,
  previousClose,
}: {
  data: StockWidgetData;
  selectedTimeframe: Timeframe;
  isDark: boolean;
  previousClose?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentChartData = data.chartData?.[selectedTimeframe];
    if (!currentChartData || currentChartData.timestamps.length === 0) return;

    let chart: any;
    let cancelled = false;

    (async () => {
      const {
        createChart,
        ColorType,
        LineStyle,
        BaselineSeries,
      } = await import("lightweight-charts");

      if (cancelled) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height: 280,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: isDark ? "#6b7280" : "#9ca3af",
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: isDark ? "#21262d" : "#e8edf1", style: LineStyle.Solid },
          horzLines: { color: isDark ? "#21262d" : "#e8edf1", style: LineStyle.Solid },
        },
        crosshair: {
          vertLine: { color: isDark ? "#30363d" : "#d0d7de", labelVisible: false },
          horzLine: { color: isDark ? "#30363d" : "#d0d7de", labelVisible: true },
        },
        rightPriceScale: { borderVisible: false, visible: false },
        leftPriceScale:  { borderVisible: false, visible: true },
        timeScale:       { borderVisible: false, timeVisible: false },
        handleScroll: false,
        handleScale: false,
      });

      const prices = currentChartData.prices;
      const baselinePrice =
        selectedTimeframe === "1D"
          ? (previousClose ?? prices[0])
          : prices[0];

      const series = chart.addSeries(BaselineSeries);
      series.applyOptions({
        baseValue: { type: "price", price: baselinePrice },
        topLineColor:    isDark ? "#14b8a6" : "#0d9488",
        topFillColor1:   isDark ? "rgba(20,184,166,0.28)" : "rgba(13,148,136,0.24)",
        topFillColor2:   isDark ? "rgba(20,184,166,0.05)" : "rgba(13,148,136,0.05)",
        bottomLineColor: isDark ? "#f87171" : "#dc2626",
        bottomFillColor1: isDark ? "rgba(248,113,113,0.05)" : "rgba(220,38,38,0.05)",
        bottomFillColor2: isDark ? "rgba(248,113,113,0.28)" : "rgba(220,38,38,0.24)",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });

      series.setData(
        currentChartData.timestamps.map((ts, i) => ({
          time: (ts / 1000) as any,
          value: currentChartData.prices[i],
        }))
      );

      chart.timeScale().fitContent();

      const onResize = () => {
        if (container) chart.applyOptions({ width: container.clientWidth });
      };
      window.addEventListener("resize", onResize);

      // cleanup stored on chart ref
      (chart as any).__cleanup = () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      cancelled = true;
      if (chart) {
        (chart as any).__cleanup?.();
        chart.remove();
      }
    };
  }, [data.chartData, selectedTimeframe, isDark, previousClose]);

  return <div ref={containerRef} />;
}

// ─── widget shell (fetches data) ──────────────────────────────────────────────

export function StockWidget({ symbol }: { symbol: string }) {
  const [data, setData] = useState<StockWidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/widgets/stock?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then(setData)
      .catch((err) => setData({ symbol, shortName: symbol, error: String(err) }))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return (
      <div className="mb-3 rounded-lg border border-border p-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-muted mb-2" />
        <div className="h-8 w-32 rounded bg-muted" />
      </div>
    );
  }

  if (!data || data.error) return null;

  return <StockContent {...data} />;
}

// ─── main card ────────────────────────────────────────────────────────────────

function StockContent(props: StockWidgetData) {
  const [isDark, setIsDark] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const isPositive   = (props.regularMarketChange ?? 0) >= 0;
  const isMarketOpen = props.marketState === "REGULAR";
  const isPreMarket  = props.marketState === "PRE";
  const isPostMarket = props.marketState === "POST";

  const displayPrice = isPostMarket
    ? (props.postMarketPrice ?? props.regularMarketPrice)
    : isPreMarket
    ? (props.preMarketPrice ?? props.regularMarketPrice)
    : props.regularMarketPrice;

  const displayChange = isPostMarket
    ? (props.postMarketChange ?? props.regularMarketChange)
    : isPreMarket
    ? (props.preMarketChange ?? props.regularMarketChange)
    : props.regularMarketChange;

  const displayChangePct = isPostMarket
    ? (props.postMarketChangePercent ?? props.regularMarketChangePercent)
    : isPreMarket
    ? (props.preMarketChangePercent ?? props.regularMarketChangePercent)
    : props.regularMarketChangePercent;

  const changeColor = isPositive
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  const TIMEFRAMES: Timeframe[] = ["1D", "5D", "1M", "3M", "6M", "1Y", "MAX"];

  return (
    <div className="mb-3 rounded-lg border border-border overflow-hidden">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {props.website && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://logo.clearbit.com/${new URL(props.website).hostname}`}
                  alt=""
                  className="w-8 h-8 rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <h3 className="text-2xl font-bold text-foreground">{props.symbol}</h3>
              {props.exchange && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">
                  {props.exchange}
                </span>
              )}
              {isMarketOpen && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Live</span>
                </div>
              )}
              {isPreMarket && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800">
                  <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Pre-Market</span>
                </div>
              )}
              {isPostMarket && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800">
                  <Clock className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-400">After Hours</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{props.longName || props.shortName}</p>
          </div>

          <div className="text-right">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-medium text-foreground">
                {props.currency === "USD" ? "$" : ""}
                {fmt(displayPrice)}
              </span>
            </div>
            <div className={`flex items-center justify-end gap-1 ${changeColor}`}>
              {isPositive
                ? <ArrowUpRight className="w-4 h-4" />
                : (displayChange ?? 0) === 0
                ? <Minus className="w-4 h-4" />
                : <ArrowDownRight className="w-4 h-4" />}
              <span className="text-lg font-normal">
                {(displayChange ?? 0) >= 0 ? "+" : ""}{fmt(displayChange)}
              </span>
              <span className="text-sm font-normal">
                ({(displayChangePct ?? 0) >= 0 ? "+" : ""}{fmt(displayChangePct)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Chart */}
        {props.chartData && (
          <div className="bg-muted/20 rounded-lg overflow-hidden">
            {/* Timeframe tabs */}
            <div className="flex items-center p-3 border-b border-border">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  disabled={!props.chartData?.[tf]}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    timeframe === tf
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="p-4">
              <Chart
                data={props}
                selectedTimeframe={timeframe}
                isDark={isDark}
                previousClose={props.regularMarketPreviousClose}
              />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 border-t border-border">
              {[
                ["Prev Close", `$${fmt(props.regularMarketPreviousClose)}`],
                ["52W Range",  `$${fmt(props.fiftyTwoWeekLow, 2)}–$${fmt(props.fiftyTwoWeekHigh, 2)}`],
                ["Market Cap", fmtLarge(props.marketCap)],
                ["Open",       `$${fmt(props.regularMarketOpen)}`],
                ["P/E Ratio",  props.trailingPE ? fmt(props.trailingPE) : "N/A"],
                ["Div Yield",  props.dividendYield ? `${fmt(props.dividendYield * 100)}%` : "N/A"],
                ["Day Range",  `$${fmt(props.regularMarketDayLow, 2)}–$${fmt(props.regularMarketDayHigh, 2)}`],
                ["Volume",     fmtLarge(props.regularMarketVolume)],
                ["EPS",        props.earningsPerShare ? `$${fmt(props.earningsPerShare)}` : "N/A"],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex justify-between p-3 ${i % 3 !== 2 ? "border-r" : ""} ${i >= 3 ? "border-t" : ""} border-border`}
                >
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
