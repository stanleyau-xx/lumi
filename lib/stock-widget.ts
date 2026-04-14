/**
 * Stock / crypto data via yahoo-finance2.
 * Ported from Vane (ItzCrazyKns/Vane) — MIT licence.
 */
// @ts-ignore — yahoo-finance2 types are bundled with the package
import yahooFinance from "yahoo-finance2";

const yf = new (yahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export interface StockWidgetData {
  symbol: string;
  shortName: string;
  longName?: string;
  exchange?: string;
  currency?: string;
  marketState?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  trailingPE?: number;
  dividendYield?: number;
  earningsPerShare?: number;
  website?: string;
  postMarketPrice?: number;
  postMarketChange?: number;
  postMarketChangePercent?: number;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  chartData?: {
    "1D"?: { timestamps: number[]; prices: number[] } | null;
    "5D"?: { timestamps: number[]; prices: number[] } | null;
    "1M"?: { timestamps: number[]; prices: number[] } | null;
    "3M"?: { timestamps: number[]; prices: number[] } | null;
    "6M"?: { timestamps: number[]; prices: number[] } | null;
    "1Y"?: { timestamps: number[]; prices: number[] } | null;
    MAX?: { timestamps: number[]; prices: number[] } | null;
  };
  error?: string;
}

function toChartSeries(chart: any): { timestamps: number[]; prices: number[] } | null {
  if (!chart?.quotes?.length) return null;
  const valid = chart.quotes.filter((q: any) => q.close != null);
  if (!valid.length) return null;
  return {
    timestamps: valid.map((q: any) => (q.date instanceof Date ? q.date.getTime() : q.date)),
    prices: valid.map((q: any) => q.close),
  };
}

/** Resolve a natural-language query to a Yahoo Finance ticker symbol. */
export async function searchTicker(query: string): Promise<string | null> {
  try {
    const results = await yf.search(query);
    const symbol = results?.quotes?.[0]?.symbol as string | undefined;
    return symbol ?? null;
  } catch {
    return null;
  }
}

/** Fetch full widget data for a known ticker symbol. */
export async function fetchByTicker(ticker: string): Promise<StockWidgetData> {
  try {
    const quote: any = await yf.quote(ticker);

    const now = new Date();
    const ms = (days: number) => new Date(Date.now() - days * 86_400_000);

    const [chart1D, chart5D, chart1M, chart3M, chart6M, chart1Y, chartMAX] =
      await Promise.all([
        yf.chart(ticker, { period1: ms(2),   period2: now, interval: "5m"  }).catch(() => null),
        yf.chart(ticker, { period1: ms(6),   period2: now, interval: "15m" }).catch(() => null),
        yf.chart(ticker, { period1: ms(30),                interval: "1d"  }).catch(() => null),
        yf.chart(ticker, { period1: ms(90),                interval: "1d"  }).catch(() => null),
        yf.chart(ticker, { period1: ms(180),               interval: "1d"  }).catch(() => null),
        yf.chart(ticker, { period1: ms(365),               interval: "1d"  }).catch(() => null),
        yf.chart(ticker, { period1: ms(3650),              interval: "1wk" }).catch(() => null),
      ]);

    return {
      symbol:                      quote.symbol,
      shortName:                   quote.shortName ?? ticker,
      longName:                    quote.longName,
      exchange:                    quote.exchange,
      currency:                    quote.currency,
      marketState:                 quote.marketState,
      regularMarketPrice:          quote.regularMarketPrice,
      regularMarketChange:         quote.regularMarketChange,
      regularMarketChangePercent:  quote.regularMarketChangePercent,
      regularMarketPreviousClose:  quote.regularMarketPreviousClose,
      regularMarketOpen:           quote.regularMarketOpen,
      regularMarketDayHigh:        quote.regularMarketDayHigh,
      regularMarketDayLow:         quote.regularMarketDayLow,
      regularMarketVolume:         quote.regularMarketVolume,
      marketCap:                   quote.marketCap,
      fiftyTwoWeekLow:             quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh:            quote.fiftyTwoWeekHigh,
      trailingPE:                  quote.trailingPE,
      dividendYield:               quote.dividendYield,
      earningsPerShare:            quote.epsTrailingTwelveMonths,
      website:                     quote.website,
      postMarketPrice:             quote.postMarketPrice,
      postMarketChange:            quote.postMarketChange,
      postMarketChangePercent:     quote.postMarketChangePercent,
      preMarketPrice:              quote.preMarketPrice,
      preMarketChange:             quote.preMarketChange,
      preMarketChangePercent:      quote.preMarketChangePercent,
      chartData: {
        "1D":  toChartSeries(chart1D),
        "5D":  toChartSeries(chart5D),
        "1M":  toChartSeries(chart1M),
        "3M":  toChartSeries(chart3M),
        "6M":  toChartSeries(chart6M),
        "1Y":  toChartSeries(chart1Y),
        "MAX": toChartSeries(chartMAX),
      },
    };
  } catch (err: any) {
    return { symbol: ticker, shortName: ticker, error: err.message ?? String(err) };
  }
}

/** Convenience: search + fetch in one call. Returns null if ticker not found. */
export async function fetchStockWidget(
  query: string,
): Promise<{ ticker: string; data: StockWidgetData; llmContext: string } | null> {
  const ticker = await searchTicker(query);
  if (!ticker) return null;

  const data = await fetchByTicker(ticker);
  if (data.error) return null;

  const llmContext =
    `Current price of ${data.shortName} (${data.symbol}) is ` +
    `${data.regularMarketPrice} ${data.currency ?? ""}. ` +
    `Change: ${data.regularMarketChange?.toFixed(2)} (${data.regularMarketChangePercent?.toFixed(2)}%). ` +
    `Market cap: ${data.marketCap}. P/E: ${data.trailingPE ?? "N/A"}.`;

  return { ticker, data, llmContext };
}
