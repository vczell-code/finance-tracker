import YahooFinance from "yahoo-finance2";
import type { DB } from "@/db";
import { fxRates, holdings, stockPrices } from "@/db/schema";
import { toISODate, todayISODate } from "@/lib/dates";
import { getSettings } from "./settings.service";

type Writer = Pick<DB, "insert">;

export const STALE_TTL_MS = 12 * 60 * 60 * 1000;

/** Minimal shape of a yahoo-finance2 quote that we rely on. */
export interface RawQuote {
  symbol: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketTime?: Date | string | number;
  shortName?: string;
  longName?: string;
  fullExchangeName?: string;
  exchange?: string;
}

export interface NormalizedQuote {
  ticker: string;
  closePrice: number;
  previousClose: number;
  currency: string;
  priceDate: string;
  name: string;
  exchange: string | null;
}

/** Pluggable quote source so services can be tested without the network. */
export interface QuoteProvider {
  quote(symbols: string[]): Promise<RawQuote[]>;
}

let yfSingleton: InstanceType<typeof YahooFinance> | null = null;
function yf() {
  yfSingleton ??= new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  return yfSingleton;
}

export const yahooQuoteProvider: QuoteProvider = {
  async quote(symbols) {
    if (symbols.length === 0) return [];
    const res = await yf().quote(symbols, { return: "array" });
    return res as unknown as RawQuote[];
  },
};

/** London quotes come back in pence ("GBp"/"GBX"); everything else is passed through upper-cased. */
export function isPenceCurrency(currency: string | undefined | null): boolean {
  return currency === "GBp" || currency === "GBX" || currency === "GBx";
}

export function normalizeCurrency(currency: string | undefined | null): string {
  if (!currency) return "USD";
  return isPenceCurrency(currency) ? "GBP" : currency.toUpperCase();
}

function quoteDate(t: RawQuote["regularMarketTime"]): string {
  if (t === undefined || t === null) return todayISODate();
  const d = t instanceof Date ? t : new Date(typeof t === "number" && t < 1e12 ? t * 1000 : t);
  return Number.isNaN(d.getTime()) ? todayISODate() : toISODate(d);
}

/** Extract close/previous close, applying the GBp -> GBP /100 normalisation. Returns null if no usable price. */
export function normalizeQuote(q: RawQuote): NormalizedQuote | null {
  let closePrice = q.regularMarketPrice ?? q.regularMarketPreviousClose;
  if (closePrice === undefined || closePrice === null || !Number.isFinite(closePrice)) return null;
  let previousClose = q.regularMarketPreviousClose ?? closePrice;
  if (isPenceCurrency(q.currency)) {
    closePrice /= 100;
    previousClose /= 100;
  }
  return {
    ticker: q.symbol.toUpperCase(),
    closePrice,
    previousClose,
    currency: normalizeCurrency(q.currency),
    priceDate: quoteDate(q.regularMarketTime),
    name: q.shortName || q.longName || q.symbol,
    exchange: q.exchange ?? null,
  };
}

export function isPriceStale(fetchedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!fetchedAt) return true;
  const t = new Date(fetchedAt).getTime();
  return Number.isNaN(t) || now.getTime() - t > STALE_TTL_MS;
}

export const fxSymbol = (from: string, to: string) => `${from}${to}=X`;

/**
 * Fetch quotes in one batch; if the batch throws, fall back to one request per symbol
 * so a single bad ticker never breaks the whole refresh.
 */
async function fetchQuotesResilient(
  provider: QuoteProvider,
  symbols: string[],
): Promise<{ quotes: Map<string, RawQuote>; errors: Map<string, string> }> {
  const quotes = new Map<string, RawQuote>();
  const errors = new Map<string, string>();
  if (symbols.length === 0) return { quotes, errors };
  try {
    for (const q of await provider.quote(symbols)) quotes.set(q.symbol.toUpperCase(), q);
  } catch {
    const settled = await Promise.allSettled(symbols.map((s) => provider.quote([s])));
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        for (const q of r.value) quotes.set(q.symbol.toUpperCase(), q);
      } else {
        errors.set(symbols[i], r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    });
  }
  for (const s of symbols) {
    if (!quotes.has(s.toUpperCase()) && !errors.has(s)) errors.set(s, "No quote returned");
  }
  return { quotes, errors };
}

export function upsertStockPrice(db: Writer, q: NormalizedQuote, fetchedAt: string) {
  const row = {
    ticker: q.ticker,
    closePrice: q.closePrice,
    previousClose: q.previousClose,
    currency: q.currency,
    priceDate: q.priceDate,
    fetchedAt,
  };
  db.insert(stockPrices).values(row).onConflictDoUpdate({ target: stockPrices.ticker, set: row }).run();
}

export function upsertFxRate(db: Writer, pair: string, rate: number, fetchedAt: string) {
  db.insert(fxRates)
    .values({ pair, rate, fetchedAt })
    .onConflictDoUpdate({ target: fxRates.pair, set: { rate, fetchedAt } })
    .run();
}

export interface RefreshResult {
  updatedTickers: string[];
  failedTickers: { ticker: string; error: string }[];
  lastUpdated: string;
}

export async function refreshMarketData(
  db: DB,
  { force = false, provider = yahooQuoteProvider, now = new Date() }: { force?: boolean; provider?: QuoteProvider; now?: Date } = {},
): Promise<RefreshResult> {
  const { baseCurrency } = getSettings(db);
  const allHoldings = db.select().from(holdings).all();
  const prices = new Map(db.select().from(stockPrices).all().map((p) => [p.ticker, p]));
  const rates = new Map(db.select().from(fxRates).all().map((r) => [r.pair, r]));

  const staleTickers = allHoldings
    .map((h) => h.ticker)
    .filter((t) => force || isPriceStale(prices.get(t)?.fetchedAt, now));

  const fxPairs = [
    ...new Set(allHoldings.map((h) => normalizeCurrency(h.currency)).filter((c) => c !== baseCurrency)),
  ]
    .map((from) => ({ pair: `${from}${baseCurrency}`, symbol: fxSymbol(from, baseCurrency) }))
    .filter(({ pair }) => force || isPriceStale(rates.get(pair)?.fetchedAt, now));

  const symbols = [...staleTickers, ...fxPairs.map((p) => p.symbol)];
  const { quotes, errors } = await fetchQuotesResilient(provider, symbols);
  const fetchedAt = now.toISOString();

  const updatedTickers: string[] = [];
  const failedTickers: { ticker: string; error: string }[] = [];

  db.transaction((tx) => {
    for (const ticker of staleTickers) {
      const raw = quotes.get(ticker.toUpperCase());
      const q = raw ? normalizeQuote(raw) : null;
      if (q) {
        upsertStockPrice(tx, { ...q, ticker }, fetchedAt);
        updatedTickers.push(ticker);
      } else {
        failedTickers.push({ ticker, error: errors.get(ticker) ?? "Quote had no price" });
      }
    }
    for (const { pair, symbol } of fxPairs) {
      const raw = quotes.get(symbol.toUpperCase());
      const rate = raw?.regularMarketPrice ?? raw?.regularMarketPreviousClose;
      if (rate && Number.isFinite(rate) && rate > 0) {
        upsertFxRate(tx, pair, rate, fetchedAt);
      } else {
        failedTickers.push({ ticker: symbol, error: errors.get(symbol) ?? "FX rate unavailable" });
      }
    }
  });

  return { updatedTickers, failedTickers, lastUpdated: fetchedAt };
}

export interface TickerSearchResult {
  ticker: string;
  name: string;
  exchange: string | null;
  typeDisp: string | null;
}

const ALLOWED_QUOTE_TYPES = new Set(["EQUITY", "ETF", "MUTUALFUND", "INDEX"]);

export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  const res = await yf().search(query, { quotesCount: 10, newsCount: 0 });
  return (res.quotes as unknown as Record<string, unknown>[])
    .filter((q) => typeof q.symbol === "string" && ALLOWED_QUOTE_TYPES.has(String(q.quoteType)))
    .map((q) => ({
      ticker: String(q.symbol),
      name: String(q.shortname || q.longname || q.symbol),
      exchange: q.exchDisp ? String(q.exchDisp) : q.exchange ? String(q.exchange) : null,
      typeDisp: q.typeDisp ? String(q.typeDisp) : null,
    }));
}

/** Fetch & validate a single ticker. Returns null if Yahoo does not know it. */
export async function fetchSingleQuote(
  ticker: string,
  provider: QuoteProvider = yahooQuoteProvider,
): Promise<NormalizedQuote | null> {
  const res = await provider.quote([ticker]);
  const raw = res.find((q) => q.symbol.toUpperCase() === ticker.toUpperCase()) ?? res[0];
  return raw ? normalizeQuote(raw) : null;
}
