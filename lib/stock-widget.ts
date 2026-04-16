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

/** Well-known US companies → ticker symbols */
const US_TICKERS: Record<string, string> = {
  // Crypto (long names before short ones to avoid substring collisions)
  bitcoin: "BTC-USD", ethereum: "ETH-USD", dogecoin: "DOGE-USD", shiba: "SHIB-USD",
  btc: "BTC-USD", eth: "ETH-USD", doge: "DOGE-USD", shib: "SHIB-USD",
  solana: "SOL", sol: "SOL", ripple: "XRP", xrp: "XRP",
  // Company names
  tesla: "TSLA", tsla: "TSLA",
  apple: "AAPL", aapl: "AAPL",
  nvidia: "NVDA", nvda: "NVDA",
  google: "GOOGL", googl: "GOOGL",
  alphabet: "GOOGL",
  microsoft: "MSFT", msft: "MSFT",
  amazon: "AMZN", amzn: "AMZN",
  meta: "META",
  facebook: "META",
  netflix: "NFLX", nflx: "NFLX",
  amd: "AMD",
  intel: "INTC", intc: "INTC",
  ibm: "IBM",
  nike: "NKE", nke: "NKE",
  disney: "DIS", dis: "DIS",
  paypal: "PYPL", pypl: "PYPL",
  coinbase: "COIN",
  spotify: "SPOT", spot: "SPOT",
  shopify: "SHOP", shop: "SHOP",
  palantir: "PLTR", pltr: "PLTR",
  snowflake: "SNOW", snow: "SNOW",
  square: "SQ", sq: "SQ",
  // ETFs / indices (must come after crypto to avoid "coin" matching "crypto" etc.)
  spy: "SPY", spx: "SPX", qqq: "QQQ", iwm: "IWM", tlt: "TLT",
  gld: "GLD", slv: "SLV",
  // US banks / blue chips
  jpm: "JPM", gs: "GS", ms: "MS", bac: "BAC", c: "C", wfc: "WFC",
  ko: "KO", pep: "PEP", wmt: "WMT", ubs: "UBS",
  nok: "NOK", bb: "BB",
};

/** Well-known international companies → [ticker, suffix] */
const INTNL_TICKERS: Array<[string, string]> = [
  // Hong Kong
  ["hsbc", "0005.HK"], ["0005", "0005.HK"], ["9988", "9988.HK"],
  ["tencent", "0700.HK"], ["0700", "0700.HK"],
  ["alibaba", "9988.HK"],
  ["china mobile", "0941.HK"], ["0941", "0941.HK"],
  ["cmb", "3968.HK"], ["3968", "3968.HK"],
  ["ccb", "0939.HK"], ["0939", "0939.HK"],
  ["icbc", "1398.HK"], ["1398", "1398.HK"],
  ["hkex", "0388.HK"], ["0388", "0388.HK"],
  ["cnooc", "0883.HK"], ["0883", "0883.HK"],
  ["ping an", "2318.HK"], ["2318", "2318.HK"],
  ["china life", "2628.HK"], ["2628", "2628.HK"],
  [" PetroChina", "0857.HK"], ["0857", "0857.HK"],
  // UK
  ["hsbc uk", "HSBA.L"], ["hsbc london", "HSBA.L"], ["lloyds", "LLOY.L"],
  ["bp", "BP.L"], ["shell", "SHEL.L"], ["astrazeneca", "AZN.L"],
  ["azn", "AZN.L"], ["gsk", "GSK.L"], ["unilever", "ULVR.L"],
  ["vodafone", "VOD.L"], ["rio tinto", "RIO.L"], ["glencore", "GLEN.L"],
  // Europe
  ["asml", "ASML.AS"], ["nestle", "NESN.S"], ["novo nordisk", "NOVO.B"],
  ["lvmh", "MC.PA"], ["sanofi", "SAN.PA"], ["siemens", "SIE.DE"],
  ["sap", "SAP.DE"], ["adidas", "ADS.DE"], ["bmw", "BMW.DE"],
  // Canada
  ["enbridge", "ENB.TO"], ["td bank", "TD.TO"], ["royal bank canada", "RY.TO"],
  ["bmo", "BMO.TO"], ["scotiabank", "BNS.TO"],
  // Australia
  ["commonwealth bank", "CBA.AX"], ["cba", "CBA.AX"],
  ["anz", "ANZ.AX"], ["westpac", "WBC.AX"], ["national australia bank", "NAB.AX"],
  // Japan
  ["toyota", "7203.T"], ["sony", "6758.T"], ["softbank", "9984.T"],
  ["nintendo", "7974.T"], ["nintendo", "7974.T"], ["mitsubishi", "8306.T"],
  // China
  ["tencent china", "0700.HK"],
];

/** Region keywords → exchange suffix attempts (in order) */
const REGION_SUFFIXES: Array<{ keywords: string[]; suffixes: string[] }> = [
  { keywords: ["hk", "hong kong", "hkse", "香港"], suffixes: [".HK"] },
  { keywords: ["london", "uk", "ftse", "lse", "hsba", "lloyd"], suffixes: [".L"] },
  { keywords: ["australia", "asx", "aus"], suffixes: [".AX"] },
  { keywords: ["canada", "toronto", "tsx", "cda"], suffixes: [".TO"] },
  { keywords: ["germany", "deutschland", "dax", "xetra"], suffixes: [".DE"] },
  { keywords: ["japan", "tokyo", "nikkei", "tse", "日本"], suffixes: [".T"] },
  { keywords: ["france", "paris", "cac"], suffixes: [".PA"] },
  { keywords: ["netherlands", "amsterdam", "euronext"], suffixes: [".AS"] },
  { keywords: ["switzerland", "zurich", "six", "zkb"], suffixes: [".SW"] },
  { keywords: ["china", "shanghai", "shenzhen", "a-shares", "中國"], suffixes: [".SS", ".SZ"] },
];

/** Extract plain company name from a stock query */
function cleanCompanyName(query: string): string {
  return query
    .toLowerCase()
    .replace(/\b(stock|share|price|shares|quote|market|current|today|buy|sell|pay|check|how much|what is|how is)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if all words in `phrase` appear as substrings in `text`.
 * Handles word-order independence: "uk hsbc" matches "hsbc uk".
 */
function allWordsPresent(text: string, phrase: string): boolean {
  const phraseWords = phrase.toLowerCase().split(/\s+/);
  return phraseWords.every((w) => text.includes(w));
}

/** Resolve a natural-language query to a Yahoo Finance ticker symbol. */
export async function searchTicker(query: string): Promise<string | null> {
  const lowerRaw = query.toLowerCase();
  const lower = lowerRaw.replace(/[^a-z0-9\s]/g, " ");

  try {
    // 1. Extract ticker from parentheses — "HSBC (0005.HK)"
    const parenMatch = query.match(/\(([A-Z0-9]{2,8})\)/);
    if (parenMatch) {
      const candidate = parenMatch[1];
      try {
        const quote: any = await yf.quote(candidate);
        if (quote?.symbol) return quote.symbol;
      } catch { /* invalid ticker */ }
    }

    // 2. International known companies — sorted longest-first to prefer specific matches
    const sortedIntnl = [...INTNL_TICKERS].sort((a, b) => b[0].length - a[0].length);
    for (const [name, ticker] of sortedIntnl) {
      // Use allWordsPresent so "uk hsbc" matches "hsbc uk" (any order)
      if (allWordsPresent(lower, name)) {
        try {
          const quote: any = await yf.quote(ticker);
          if (quote?.symbol) return quote.symbol;
        } catch { /* keep trying */ }
      }
    }

    // 3. US known companies — sorted longest-first
    const sortedUS = Object.entries(US_TICKERS).sort((a, b) => b[0].length - a[0].length);
    for (const [name, ticker] of sortedUS) {
      if (allWordsPresent(lower, name)) {
        try {
          const quote: any = await yf.quote(ticker);
          if (quote?.symbol) return quote.symbol;
        } catch { /* keep trying */ }
      }
    }


    const company = cleanCompanyName(query);
    if (company.length >= 2) {
      for (const region of REGION_SUFFIXES) {
        if (region.keywords.some((kw) => lower.includes(kw))) {
          for (const suffix of region.suffixes) {
            // Try company name + suffix
            const candidates = [
              company.replace(/\s+/g, "") + suffix,
              company.split(/\s+/)[0] + suffix,
            ];
            for (const ticker of candidates) {
              try {
                const quote: any = await yf.quote(ticker);
                if (quote?.symbol) return quote.symbol;
              } catch { /* try next */ }
            }
          }
        }
      }
    }

    return null;
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
