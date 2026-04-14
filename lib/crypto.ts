/**
 * Real-time crypto prices.
 * Primary: Binance public API (no key, very fast, highly reliable).
 * Fallback: CoinGecko public API (no key, broader coverage).
 */

// Common name/symbol → Binance base asset mapping
const SYMBOL_MAP: Record<string, string> = {
  bitcoin:       "BTC",
  btc:           "BTC",
  ethereum:      "ETH",
  eth:           "ETH",
  solana:        "SOL",
  sol:           "SOL",
  ripple:        "XRP",
  xrp:           "XRP",
  dogecoin:      "DOGE",
  doge:          "DOGE",
  cardano:       "ADA",
  ada:           "ADA",
  binancecoin:   "BNB",
  bnb:           "BNB",
  avalanche:     "AVAX",
  avax:          "AVAX",
  chainlink:     "LINK",
  link:          "LINK",
  polkadot:      "DOT",
  dot:           "DOT",
  litecoin:      "LTC",
  ltc:           "LTC",
  uniswap:       "UNI",
  uni:           "UNI",
  shiba:         "SHIB",
  shib:          "SHIB",
  polygon:       "MATIC",
  matic:         "MATIC",
  tron:          "TRX",
  trx:           "TRX",
};

export function extractSymbol(query: string): string | null {
  const normalized = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  for (const word of normalized.split(/\s+/)) {
    if (SYMBOL_MAP[word]) return SYMBOL_MAP[word];
  }
  return null;
}

async function fetchFromBinance(symbol: string): Promise<string | null> {
  const pair = `${symbol}USDT`;
  try {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.log(`[Crypto] Binance ${pair} HTTP ${res.status}`);
      return null;
    }
    const d = await res.json();
    if (!d.lastPrice) return null;

    const price     = parseFloat(d.lastPrice);
    const change24h = parseFloat(d.priceChangePercent);
    const high      = parseFloat(d.highPrice);
    const low       = parseFloat(d.lowPrice);
    const vol       = parseFloat(d.quoteVolume); // in USDT

    const fmt = (n: number) =>
      n >= 1
        ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : n.toFixed(6);

    const changeStr = `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`;

    return [
      `REAL-TIME PRICE DATA (fetched just now):`,
      `- Asset:      ${symbol}/USDT`,
      `- Price:      $${fmt(price)} USD`,
      `- 24h change: ${changeStr}`,
      `- 24h high:   $${fmt(high)}`,
      `- 24h low:    $${fmt(low)}`,
      `- 24h volume: $${(vol / 1e9).toFixed(2)}B`,
      ``,
      `INSTRUCTION: Write ONE sentence with the current price and 24h change only. Example: "${symbol} is trading at $${fmt(price)} (${changeStr} in 24h)." Do NOT repeat any number more than once. Do NOT say you lack real-time data.`,
    ].join("\n");
  } catch (err) {
    console.log(`[Crypto] Binance error for ${pair}:`, err);
    return null;
  }
}

async function fetchFromCoinGecko(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
    console.log("[Crypto] CoinGecko search:", searchUrl);
    const searchRes = await fetch(searchUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!searchRes.ok) {
      console.log(`[Crypto] CoinGecko search HTTP ${searchRes.status}`);
      return null;
    }

    const searchData = await searchRes.json();
    const coin = searchData.coins?.[0];
    if (!coin) {
      console.log("[Crypto] CoinGecko no coins found for query:", query);
      return null;
    }
    console.log("[Crypto] CoinGecko coin match:", coin.id, coin.symbol);

    const priceUrl =
      `https://api.coingecko.com/api/v3/simple/price` +
      `?ids=${encodeURIComponent(coin.id)}` +
      `&vs_currencies=usd` +
      `&include_24hr_change=true` +
      `&include_market_cap=true`;

    const priceRes = await fetch(priceUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!priceRes.ok) {
      console.log(`[Crypto] CoinGecko price HTTP ${priceRes.status}`);
      return null;
    }

    const priceData = await priceRes.json();
    const d = priceData[coin.id];
    if (!d || d.usd == null) {
      console.log("[Crypto] CoinGecko price data empty for:", coin.id);
      return null;
    }

    const price     = d.usd as number;
    const change24h = d.usd_24h_change as number | undefined;
    const marketCap = d.usd_market_cap as number | undefined;

    const fmt = (n: number) =>
      n >= 1
        ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : n.toFixed(6);

    const changeStr = change24h != null
      ? ` (${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}% 24h)`
      : "";
    const mcLine = marketCap ? `\n- Market cap: $${(marketCap / 1e9).toFixed(2)}B` : "";

    return [
      `REAL-TIME PRICE DATA (fetched just now):`,
      `${coin.name} (${(coin.symbol as string).toUpperCase()}) = $${fmt(price)} USD${changeStr}${mcLine}`,
      ``,
      `INSTRUCTION: Report the price using the data above. State each fact once.`,
    ].join("\n");
  } catch (err) {
    console.log("[Crypto] CoinGecko error:", err);
    return null;
  }
}

export async function fetchCryptoPrice(query: string): Promise<string | null> {
  console.log("[Crypto] fetchCryptoPrice query:", query);

  // Try Binance first (fast, reliable, works for all major cryptos)
  const symbol = extractSymbol(query);
  if (symbol) {
    console.log("[Crypto] Binance lookup for symbol:", symbol);
    const result = await fetchFromBinance(symbol);
    if (result) return result;
  }

  // Fall back to CoinGecko for unknown/long-tail coins
  return fetchFromCoinGecko(query);
}
