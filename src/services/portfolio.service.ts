import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { fxRates, holdings, stockPrices, type FxRate, type Holding, type StockPrice } from "@/db/schema";
import {
  fetchSingleQuote,
  fxSymbol,
  isPriceStale,
  normalizeCurrency,
  upsertFxRate,
  upsertStockPrice,
  yahooQuoteProvider,
  type QuoteProvider,
} from "./market-data.service";
import { getSettings } from "./settings.service";

export interface EnrichedHolding extends Holding {
  closePrice: number | null;
  previousClose: number | null;
  priceDate: string | null;
  fetchedAt: string | null;
  fxRate: number | null;
  nativeMarketValue: number | null;
  baseMarketValue: number | null;
  dayChangeNative: number | null;
  dayChangeBase: number | null;
  dayChangePercent: number | null;
  costBasisNative: number | null;
  unrealizedPnlNative: number | null;
  unrealizedPnlBase: number | null;
  unrealizedPnlPercent: number | null;
  allocationPercent: number;
  isStale: boolean;
}

export interface PortfolioSummary {
  totalValueBase: number;
  totalDayChangeBase: number;
  previousTotalValueBase: number;
  totalDayChangePercent: number;
  totalCostBasisBase: number | null;
  totalUnrealizedPnlBase: number | null;
  holdingsCount: number;
}

export interface PortfolioPayload {
  holdings: EnrichedHolding[];
  summary: PortfolioSummary;
  baseCurrency: string;
  isStale: boolean;
  lastUpdated: string | null;
}

/** Pure valuation math (spec §3.5). */
export function valuePortfolio(
  hs: Holding[],
  prices: Map<string, StockPrice>,
  rates: Map<string, FxRate>,
  baseCurrency: string,
  now: Date = new Date(),
): PortfolioPayload {
  let anyStale = false;
  let oldestFetch: string | null = null;

  const enriched: EnrichedHolding[] = hs.map((h) => {
    const price = prices.get(h.ticker);
    const currency = normalizeCurrency(h.currency);
    const fxRate = currency === baseCurrency ? 1 : (rates.get(`${currency}${baseCurrency}`)?.rate ?? null);
    const stale = isPriceStale(price?.fetchedAt, now);
    if (stale) anyStale = true;
    if (price && (!oldestFetch || price.fetchedAt < oldestFetch)) oldestFetch = price.fetchedAt;

    const base: EnrichedHolding = {
      ...h,
      currency,
      closePrice: null,
      previousClose: null,
      priceDate: null,
      fetchedAt: null,
      fxRate,
      nativeMarketValue: null,
      baseMarketValue: null,
      dayChangeNative: null,
      dayChangeBase: null,
      dayChangePercent: null,
      costBasisNative: null,
      unrealizedPnlNative: null,
      unrealizedPnlBase: null,
      unrealizedPnlPercent: null,
      allocationPercent: 0,
      isStale: stale,
    };
    if (h.avgCostPerShare !== null) base.costBasisNative = h.shares * h.avgCostPerShare;
    if (!price) return base;

    const { closePrice, previousClose } = price;
    const nativeMarketValue = h.shares * closePrice;
    const dayChangeNative = h.shares * (closePrice - previousClose);
    base.closePrice = closePrice;
    base.previousClose = previousClose;
    base.priceDate = price.priceDate;
    base.fetchedAt = price.fetchedAt;
    base.nativeMarketValue = nativeMarketValue;
    base.baseMarketValue = fxRate !== null ? nativeMarketValue * fxRate : null;
    base.dayChangeNative = dayChangeNative;
    base.dayChangeBase = fxRate !== null ? dayChangeNative * fxRate : null;
    base.dayChangePercent = previousClose > 0 ? ((closePrice - previousClose) / previousClose) * 100 : 0;

    if (h.avgCostPerShare !== null) {
      const costBasisNative = h.shares * h.avgCostPerShare;
      const unrealizedPnlNative = nativeMarketValue - costBasisNative;
      base.unrealizedPnlNative = unrealizedPnlNative;
      base.unrealizedPnlBase = fxRate !== null ? unrealizedPnlNative * fxRate : null;
      base.unrealizedPnlPercent = costBasisNative > 0 ? (unrealizedPnlNative / costBasisNative) * 100 : null;
    }
    return base;
  });

  const totalValueBase = enriched.reduce((s, h) => s + (h.baseMarketValue ?? 0), 0);
  const totalDayChangeBase = enriched.reduce((s, h) => s + (h.dayChangeBase ?? 0), 0);
  const previousTotalValueBase = totalValueBase - totalDayChangeBase;

  const withCost = enriched.filter((h) => h.unrealizedPnlBase !== null && h.costBasisNative !== null && h.fxRate !== null);
  const totalCostBasisBase = withCost.length
    ? withCost.reduce((s, h) => s + h.costBasisNative! * h.fxRate!, 0)
    : null;
  const totalUnrealizedPnlBase = withCost.length ? withCost.reduce((s, h) => s + h.unrealizedPnlBase!, 0) : null;

  for (const h of enriched) {
    h.allocationPercent = totalValueBase > 0 && h.baseMarketValue !== null ? (h.baseMarketValue / totalValueBase) * 100 : 0;
  }
  enriched.sort((a, b) => (b.baseMarketValue ?? 0) - (a.baseMarketValue ?? 0));

  return {
    holdings: enriched,
    summary: {
      totalValueBase,
      totalDayChangeBase,
      previousTotalValueBase,
      totalDayChangePercent: previousTotalValueBase > 0 ? (totalDayChangeBase / previousTotalValueBase) * 100 : 0,
      totalCostBasisBase,
      totalUnrealizedPnlBase,
      holdingsCount: enriched.length,
    },
    baseCurrency,
    isStale: hs.length > 0 && anyStale,
    lastUpdated: oldestFetch,
  };
}

/** Reads strictly from SQLite — never touches the network. */
export function getPortfolio(db: DB, now: Date = new Date()): PortfolioPayload {
  const { baseCurrency } = getSettings(db);
  const hs = db.select().from(holdings).all();
  const prices = new Map(db.select().from(stockPrices).all().map((p) => [p.ticker, p]));
  const rates = new Map(db.select().from(fxRates).all().map((r) => [r.pair, r]));
  return valuePortfolio(hs, prices, rates, baseCurrency, now);
}

export class HoldingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function getHoldingByTicker(db: DB, ticker: string): Holding | undefined {
  return db.select().from(holdings).where(eq(holdings.ticker, ticker)).get();
}

/** Validates ticker against Yahoo, then inserts holding and seeds price + FX cache. */
export async function addHolding(
  db: DB,
  input: { ticker: string; shares: number; avgCostPerShare?: number | null; notes?: string | null },
  provider: QuoteProvider = yahooQuoteProvider,
): Promise<Holding> {
  const ticker = input.ticker.toUpperCase();
  if (getHoldingByTicker(db, ticker)) {
    throw new HoldingError(`${ticker} is already in your portfolio — edit its shares instead.`, 409);
  }
  let quote;
  try {
    quote = await fetchSingleQuote(ticker, provider);
  } catch (e) {
    throw new HoldingError(`Could not look up ${ticker}: ${e instanceof Error ? e.message : String(e)}`, 502);
  }
  if (!quote) throw new HoldingError(`Unknown ticker "${ticker}"`, 400);

  const { baseCurrency } = getSettings(db);
  const now = new Date().toISOString();

  let fxRate: number | null = null;
  if (quote.currency !== baseCurrency) {
    try {
      const [fx] = await provider.quote([fxSymbol(quote.currency, baseCurrency)]);
      fxRate = fx?.regularMarketPrice ?? fx?.regularMarketPreviousClose ?? null;
    } catch {
      fxRate = null; // refresh will retry later
    }
  }

  return db.transaction((tx) => {
    const holding = tx
      .insert(holdings)
      .values({
        ticker,
        name: quote.name,
        exchange: quote.exchange,
        shares: input.shares,
        avgCostPerShare: input.avgCostPerShare ?? null,
        currency: quote.currency,
        notes: input.notes ?? null,
        updatedAt: now,
      })
      .returning()
      .get();
    upsertStockPrice(tx, { ...quote, ticker }, now);
    if (fxRate && fxRate > 0) upsertFxRate(tx, `${quote.currency}${baseCurrency}`, fxRate, now);
    return holding;
  });
}

export function updateHolding(
  db: DB,
  id: number,
  patch: { shares?: number; avgCostPerShare?: number | null; notes?: string | null },
): Holding | undefined {
  return db
    .update(holdings)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(holdings.id, id))
    .returning()
    .get();
}

export function deleteHolding(db: DB, id: number): boolean {
  const h = db.select().from(holdings).where(eq(holdings.id, id)).get();
  if (!h) return false;
  db.transaction((tx) => {
    tx.delete(holdings).where(eq(holdings.id, id)).run();
    tx.delete(stockPrices).where(eq(stockPrices.ticker, h.ticker)).run();
  });
  return true;
}
