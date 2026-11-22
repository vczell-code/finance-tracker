import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/db";
import { fxRates, holdings, stockPrices, type FxRate, type Holding, type StockPrice } from "@/db/schema";
import {
  isPriceStale,
  normalizeQuote,
  refreshMarketData,
  type QuoteProvider,
  type RawQuote,
} from "@/services/market-data.service";
import { addHolding, getPortfolio, valuePortfolio } from "@/services/portfolio.service";
import { createTestDb } from "./helpers/test-db";

const NOW = new Date("2026-11-22T12:00:00Z");
const FRESH = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(); // 1h ago
const OLD = new Date(NOW.getTime() - 13 * 60 * 60 * 1000).toISOString(); // 13h ago

function holding(p: Partial<Holding> & Pick<Holding, "ticker">): Holding {
  return {
    id: 1,
    name: p.ticker,
    exchange: null,
    shares: 10,
    avgCostPerShare: null,
    currency: "EUR",
    notes: null,
    updatedAt: FRESH,
    ...p,
  };
}

function price(p: Partial<StockPrice> & Pick<StockPrice, "ticker" | "closePrice">): StockPrice {
  return { previousClose: p.closePrice, currency: "EUR", priceDate: "2026-11-21", fetchedAt: FRESH, ...p };
}

describe("valuePortfolio", () => {
  it("converts a USD holding into EUR base currency via fx_rates", () => {
    const hs = [holding({ ticker: "AAPL", currency: "USD", shares: 10, avgCostPerShare: 150 })];
    const prices = new Map([["AAPL", price({ ticker: "AAPL", closePrice: 200, previousClose: 190, currency: "USD" })]]);
    const rates = new Map<string, FxRate>([["USDEUR", { pair: "USDEUR", rate: 0.9, fetchedAt: FRESH }]]);
    const p = valuePortfolio(hs, prices, rates, "EUR", NOW);
    const h = p.holdings[0];

    expect(h.nativeMarketValue).toBe(2000);
    expect(h.baseMarketValue).toBeCloseTo(1800);
    expect(h.dayChangeNative).toBe(100);
    expect(h.dayChangeBase).toBeCloseTo(90);
    expect(h.dayChangePercent).toBeCloseTo((10 / 190) * 100);
    expect(h.unrealizedPnlNative).toBe(500);
    expect(h.unrealizedPnlBase).toBeCloseTo(450);
    expect(h.unrealizedPnlPercent).toBeCloseTo(33.333, 2);
    expect(p.summary.totalValueBase).toBeCloseTo(1800);
    expect(p.summary.totalDayChangePercent).toBeCloseTo((90 / 1710) * 100);
    expect(h.allocationPercent).toBeCloseTo(100);
  });

  it("returns null base values (not NaN) when FX rate missing", () => {
    const hs = [holding({ ticker: "AAPL", currency: "USD" })];
    const prices = new Map([["AAPL", price({ ticker: "AAPL", closePrice: 200, currency: "USD" })]]);
    const p = valuePortfolio(hs, prices, new Map(), "EUR", NOW);
    expect(p.holdings[0].baseMarketValue).toBeNull();
    expect(p.summary.totalValueBase).toBe(0);
    expect(Number.isNaN(p.summary.totalDayChangePercent)).toBe(false);
  });

  it("holdings without avgCostPerShare return unrealizedPnl null without NaN", () => {
    const hs = [holding({ ticker: "VWCE.DE", avgCostPerShare: null })];
    const prices = new Map([["VWCE.DE", price({ ticker: "VWCE.DE", closePrice: 120 })]]);
    const h = valuePortfolio(hs, prices, new Map(), "EUR", NOW).holdings[0];
    expect(h.unrealizedPnlNative).toBeNull();
    expect(h.unrealizedPnlBase).toBeNull();
    expect(h.unrealizedPnlPercent).toBeNull();
    expect(h.baseMarketValue).toBe(1200);
  });

  it("computes allocation percentages across holdings", () => {
    const hs = [holding({ id: 1, ticker: "A" }), holding({ id: 2, ticker: "B" })];
    const prices = new Map([
      ["A", price({ ticker: "A", closePrice: 30 })],
      ["B", price({ ticker: "B", closePrice: 10 })],
    ]);
    const p = valuePortfolio(hs, prices, new Map(), "EUR", NOW);
    expect(p.holdings.map((h) => [h.ticker, h.allocationPercent])).toEqual([
      ["A", 75],
      ["B", 25],
    ]);
  });
});

describe("stale cache detection", () => {
  it("flags prices older than 12h as stale and newer as fresh", () => {
    expect(isPriceStale(OLD, NOW)).toBe(true);
    expect(isPriceStale(FRESH, NOW)).toBe(false);
    expect(isPriceStale(null, NOW)).toBe(true);
  });

  it("portfolio isStale is true if any holding lacks a price or is >12h old", () => {
    const hs = [holding({ id: 1, ticker: "A" }), holding({ id: 2, ticker: "B" })];
    const fresh = new Map([
      ["A", price({ ticker: "A", closePrice: 1 })],
      ["B", price({ ticker: "B", closePrice: 1 })],
    ]);
    expect(valuePortfolio(hs, fresh, new Map(), "EUR", NOW).isStale).toBe(false);
    const missing = new Map([["A", price({ ticker: "A", closePrice: 1 })]]);
    expect(valuePortfolio(hs, missing, new Map(), "EUR", NOW).isStale).toBe(true);
    const old = new Map([
      ["A", price({ ticker: "A", closePrice: 1 })],
      ["B", price({ ticker: "B", closePrice: 1, fetchedAt: OLD })],
    ]);
    expect(valuePortfolio(hs, old, new Map(), "EUR", NOW).isStale).toBe(true);
  });
});

describe("GBp normalization", () => {
  it("divides pence prices by 100 and reports GBP", () => {
    const q = normalizeQuote({
      symbol: "VUSA.L",
      currency: "GBp",
      regularMarketPrice: 8950,
      regularMarketPreviousClose: 8900,
      regularMarketTime: new Date("2026-11-21T16:30:00Z"),
    })!;
    expect(q.currency).toBe("GBP");
    expect(q.closePrice).toBeCloseTo(89.5);
    expect(q.previousClose).toBeCloseTo(89);
    expect(q.priceDate).toBe("2026-11-21");
  });

  it("treats GBX the same way and leaves other currencies alone", () => {
    expect(normalizeQuote({ symbol: "X.L", currency: "GBX", regularMarketPrice: 100 })!.closePrice).toBe(1);
    expect(normalizeQuote({ symbol: "AAPL", currency: "USD", regularMarketPrice: 100 })!.closePrice).toBe(100);
  });

  it("falls back to previous close when regular price missing", () => {
    const q = normalizeQuote({ symbol: "A", currency: "EUR", regularMarketPreviousClose: 50 })!;
    expect(q.closePrice).toBe(50);
    expect(q.previousClose).toBe(50);
    expect(normalizeQuote({ symbol: "A", currency: "EUR" })).toBeNull();
  });
});

describe("refreshMarketData & addHolding (mocked provider)", () => {
  let db: DB;
  const quotes: Record<string, RawQuote> = {
    AAPL: { symbol: "AAPL", currency: "USD", regularMarketPrice: 200, regularMarketPreviousClose: 195, shortName: "Apple Inc.", exchange: "NMS" },
    "VUSA.L": { symbol: "VUSA.L", currency: "GBp", regularMarketPrice: 9000, regularMarketPreviousClose: 8800, shortName: "Vanguard S&P 500" },
    "USDEUR=X": { symbol: "USDEUR=X", currency: "EUR", regularMarketPrice: 0.92 },
    "GBPEUR=X": { symbol: "GBPEUR=X", currency: "EUR", regularMarketPrice: 1.17 },
  };
  const provider: QuoteProvider = {
    async quote(symbols) {
      if (symbols.length > 1 && symbols.includes("BAD")) throw new Error("batch failed");
      if (symbols.length === 1 && symbols[0] === "BAD") throw new Error("not found");
      return symbols.map((s) => quotes[s]).filter(Boolean);
    },
  };

  beforeEach(() => {
    db = createTestDb();
  });

  it("addHolding validates ticker, stores normalised currency and seeds price + fx", async () => {
    await addHolding(db, { ticker: "vusa.l", shares: 10 }, provider);
    const h = db.select().from(holdings).get()!;
    expect(h.ticker).toBe("VUSA.L");
    expect(h.currency).toBe("GBP");
    expect(db.select().from(stockPrices).get()!.closePrice).toBe(90);
    expect(db.select().from(fxRates).get()!.pair).toBe("GBPEUR");
    const p = getPortfolio(db);
    expect(p.summary.totalValueBase).toBeCloseTo(10 * 90 * 1.17);
  });

  it("addHolding rejects duplicates with 409 and unknown tickers with 400", async () => {
    await addHolding(db, { ticker: "AAPL", shares: 1 }, provider);
    await expect(addHolding(db, { ticker: "AAPL", shares: 1 }, provider)).rejects.toMatchObject({ status: 409 });
    await expect(addHolding(db, { ticker: "NOPE", shares: 1 }, provider)).rejects.toMatchObject({ status: 400 });
  });

  it("falls back to per-symbol fetches so one bad ticker doesn't break refresh", async () => {
    const now = new Date().toISOString();
    db.insert(holdings).values([
      { ticker: "AAPL", name: "Apple", shares: 1, currency: "USD", updatedAt: now },
      { ticker: "BAD", name: "Bad", shares: 1, currency: "USD", updatedAt: now },
    ]).run();
    const res = await refreshMarketData(db, { force: true, provider });
    expect(res.updatedTickers).toEqual(["AAPL"]);
    expect(res.failedTickers.map((f) => f.ticker)).toEqual(["BAD"]);
    expect(db.select().from(fxRates).get()!.rate).toBe(0.92);
  });

  it("skips fresh tickers unless forced", async () => {
    await addHolding(db, { ticker: "AAPL", shares: 1 }, provider);
    const res = await refreshMarketData(db, { force: false, provider });
    expect(res.updatedTickers).toEqual([]);
    const forced = await refreshMarketData(db, { force: true, provider });
    expect(forced.updatedTickers).toEqual(["AAPL"]);
  });
});
