# Technical Specification: Personal Finance & Portfolio Tracker

**Companion Document:** `PRD.md`
**Runtime Requirement:** Node.js `>= 22.0.0` (required by `yahoo-finance2` v4)

---

## 1. Architecture & Project Structure

A monolithic full-stack Next.js (App Router) application using local SQLite for persistence and RESTful Route Handlers (`/api/*`) consumed by React Server/Client Components.

```text
├── data/
│   └── finance.db                  # Local SQLite database (gitignored)
├── drizzle/                        # Generated SQLite migrations
├── src/
│   ├── app/
│   │   ├── layout.tsx              # App shell, sidebar/bottom nav, Cmd+K modal provider
│   │   ├── page.tsx                # Unified Dashboard (/)
│   │   ├── transactions/page.tsx   # Income, Expense & Transfer ledger
│   │   ├── subscriptions/page.tsx  # Recurring rules & fixed burn tracker
│   │   ├── budgets/page.tsx        # Monthly category budget tracker
│   │   ├── portfolio/page.tsx      # Stock holdings, EOD prices & allocation
│   │   ├── settings/page.tsx       # Base currency, categories, CSV import/export
│   │   └── api/
│   │       ├── dashboard/route.ts
│   │       ├── transactions/route.ts
│   │       ├── transactions/[id]/route.ts
│   │       ├── recurring/route.ts
│   │       ├── recurring/[id]/route.ts
│   │       ├── recurring/sync/route.ts
│   │       ├── categories/route.ts
│   │       ├── categories/[id]/route.ts
│   │       ├── portfolio/route.ts
│   │       ├── portfolio/holdings/route.ts
│   │       ├── portfolio/holdings/[id]/route.ts
│   │       ├── portfolio/refresh/route.ts
│   │       ├── portfolio/search/route.ts
│   │       ├── settings/route.ts
│   │       ├── export/csv/route.ts
│   │       └── import/csv/route.ts
│   ├── db/
│   │   ├── index.ts                # better-sqlite3 + Drizzle singleton (WAL mode)
│   │   ├── schema.ts               # Drizzle table definitions & relations
│   │   └── seed.ts                 # Idempotent default settings & category seeder
│   ├── lib/
│   │   ├── format.ts               # Currency & date formatting (Intl.NumberFormat)
│   │   ├── period.ts               # Billing period date math (monthStartDay)
│   │   └── validation.ts           # Shared Zod schemas for API & forms
│   ├── services/
│   │   ├── cashflow.service.ts     # Aggregations, budgets, savings rate
│   │   ├── recurring.service.ts    # Idempotent recurring rule processor
│   │   ├── market-data.service.ts  # yahoo-finance2 v4 wrapper & caching logic
│   │   ├── portfolio.service.ts    # Holdings valuation, FX conversion, P&L math
│   │   └── csv.service.ts          # RFC-4180 CSV export & import parser
│   └── components/
│       ├── ui/                     # shadcn/ui primitives
│       ├── layout/                 # Sidebar, MobileNav, QuickAddCommandDialog
│       ├── charts/                 # Recharts wrappers (CashFlowBar, CategoryDonut, AllocationDonut)
│       ├── transactions/           # TransactionForm, TransactionTable, FilterBar
│       ├── recurring/              # RecurringForm, UpcomingBillsCard
│       └── portfolio/              # TickerSearchCombobox, HoldingForm, HoldingsTable
├── tests/
│   ├── helpers/test-db.ts          # In-memory SQLite (:memory:) Drizzle instance
│   ├── recurring.service.test.ts
│   ├── cashflow.service.test.ts
│   ├── portfolio.service.test.ts
│   └── csv.service.test.ts
├── PRD.md
├── SPEC.md
└── CLAUDE.md
```

## 2. Database Specification (SQLite + Drizzle ORM)

### 2.1 SQLite Connection Configuration (`src/db/index.ts`)

- Database path: `process.env.DATABASE_PATH ?? "./data/finance.db"` (ensure parent directory exists on startup).
- Pragmas executed on connection init:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  ```
- Run `seedIfNeeded()` safely once on boot or via `npm run db:seed`.

### 2.2 Schema (`src/db/schema.ts`)

| Table | Column | Type | Constraints / Default | Notes |
| --- | --- | --- | --- | --- |
| **settings** | id | INTEGER | PK, default 1 | Singleton row (`CHECK (id = 1)`) |
| | baseCurrency | TEXT | NOT NULL, default `'EUR'` | ISO-4217 (EUR, USD, GBP, CHF) |
| | monthStartDay | INTEGER | NOT NULL, default 1 | 1..28 |
| | updatedAt | TEXT | NOT NULL | ISO-8601 UTC timestamp |
| **categories** | id | INTEGER | PK AUTOINCREMENT | |
| | name | TEXT | NOT NULL | e.g. "Groceries", "Rent" |
| | type | TEXT | NOT NULL | `'INCOME'` \| `'EXPENSE'` |
| | groupName | TEXT | NOT NULL | e.g. "Housing", "Food", "Subscriptions" |
| | isFixed | INTEGER | NOT NULL, default 0 | Boolean (0 \| 1): Fixed vs. Variable |
| | monthlyBudgetCents | INTEGER | NULLABLE | > 0 if set (in baseCurrency) |
| | color | TEXT | NOT NULL | Hex code (e.g. `"#3b82f6"`) |
| | icon | TEXT | NOT NULL | Lucide icon name (e.g. `"home"`) |
| | isArchived | INTEGER | NOT NULL, default 0 | Soft delete to preserve history |
| **recurring_rules** | id | INTEGER | PK AUTOINCREMENT | |
| | name | TEXT | NOT NULL | Merchant/Label (e.g. "Spotify") |
| | amountCents | INTEGER | NOT NULL | Strictly positive (> 0) |
| | currency | TEXT | NOT NULL | ISO-4217 |
| | type | TEXT | NOT NULL | `'INCOME'` \| `'EXPENSE'` |
| | categoryId | INTEGER | NOT NULL, FK → categories.id | ON DELETE RESTRICT |
| | paymentMethod | TEXT | NOT NULL, default `'BANK_TRANSFER'` | `'DEBIT'` \| `'CREDIT'` \| `'BANK_TRANSFER'` \| `'CASH'` \| `'OTHER'` |
| | frequency | TEXT | NOT NULL | `'WEEKLY'` \| `'MONTHLY'` \| `'QUARTERLY'` \| `'YEARLY'` |
| | anchorDay | INTEGER | NOT NULL | 1..31 (prevents Feb 28th drift) |
| | nextDueDate | TEXT | NOT NULL | YYYY-MM-DD |
| | lastGeneratedDate | TEXT | NULLABLE | YYYY-MM-DD |
| | isActive | INTEGER | NOT NULL, default 1 | Paused rules skip generation |
| | notes | TEXT | NULLABLE | |
| | createdAt | TEXT | NOT NULL | ISO-8601 UTC |
| **transactions** | id | INTEGER | PK AUTOINCREMENT | |
| | date | TEXT | NOT NULL | YYYY-MM-DD |
| | amountCents | INTEGER | NOT NULL | Strictly positive (> 0) |
| | currency | TEXT | NOT NULL | ISO-4217 |
| | type | TEXT | NOT NULL | `'INCOME'` \| `'EXPENSE'` \| `'TRANSFER'` |
| | categoryId | INTEGER | NULLABLE, FK → categories.id | Null allowed when type = `'TRANSFER'` |
| | merchant | TEXT | NOT NULL | Short title/payee |
| | paymentMethod | TEXT | NOT NULL, default `'DEBIT'` | `'DEBIT'` \| `'CREDIT'` \| `'BANK_TRANSFER'` \| `'CASH'` \| `'OTHER'` |
| | notes | TEXT | NULLABLE | |
| | recurringRuleId | INTEGER | NULLABLE, FK → recurring_rules.id | ON DELETE SET NULL |
| | createdAt | TEXT | NOT NULL | ISO-8601 UTC |
| **holdings** | id | INTEGER | PK AUTOINCREMENT | |
| | ticker | TEXT | NOT NULL, UNIQUE | Uppercase Yahoo symbol (e.g. AAPL, VWCE.DE) |
| | name | TEXT | NOT NULL | e.g. "Apple Inc." |
| | exchange | TEXT | NULLABLE | e.g. "NMS", "GER" |
| | shares | REAL | NOT NULL | Strictly > 0 (supports fractional) |
| | avgCostPerShare | REAL | NULLABLE | In currency; null if untracked |
| | currency | TEXT | NOT NULL | Native trading currency (USD, EUR, etc.) |
| | notes | TEXT | NULLABLE | |
| | updatedAt | TEXT | NOT NULL | ISO-8601 UTC |
| **stock_prices** | ticker | TEXT | PK | Matches holdings.ticker |
| | closePrice | REAL | NOT NULL | Latest closing/regular market price |
| | previousClose | REAL | NOT NULL | Prior session close |
| | currency | TEXT | NOT NULL | Normalized currency (see §3.4 GBp rule) |
| | priceDate | TEXT | NOT NULL | YYYY-MM-DD of market quote |
| | fetchedAt | TEXT | NOT NULL | ISO-8601 UTC |
| **fx_rates** | pair | TEXT | PK | Format: `<FROM><TO>`, e.g. `'USDEUR'` |
| | rate | REAL | NOT NULL | Multiplier (1 FROM = rate TO) |
| | fetchedAt | TEXT | NOT NULL | ISO-8601 UTC |

**Required Indexes**

- `idx_transactions_date` on `transactions(date)`
- `idx_transactions_category` on `transactions(categoryId)`
- `uidx_transactions_recurring_date` UNIQUE on `transactions(recurringRuleId, date) WHERE recurringRuleId IS NOT NULL` — enforces database-level idempotency for generated bills.

## 3. Core Domain Logic & Algorithms

### 3.1 Monetary & Precision Rules

- **Cash Flow Amounts:** Always stored as positive integers (`amountCents`). Never use floats for transaction sums or budget checks. Conversion at input: `Math.round(Number(decimalInput) * 100)`.
- **Stock Quantities & Prices:** Stored as SQLite REAL (`number` in TS). Do not round intermediate calculations; format only at presentation via `Intl.NumberFormat`.

### 3.2 Billing Period Calculation (`src/lib/period.ts`)

Given `yearMonth` ("YYYY-MM") and `monthStartDay` (1..28):

- If `monthStartDay === 1`:
  - `startDate = YYYY-MM-01`
  - `endDate` = last calendar day of YYYY-MM (28|29|30|31).
- If `monthStartDay > 1` (e.g., 25 for payday on the 25th):
  - Period "2026-11" runs from 2026-10-25 through 2026-11-24.

Helper signature:

```ts
export function getBillingPeriodRange(yearMonth: string, monthStartDay: number): {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
};
```

### 3.3 Idempotent Recurring Transaction Generator (`src/services/recurring.service.ts`)

Executed via `POST /api/recurring/sync` and automatically on Dashboard / Subscriptions load.

**Algorithm (`syncRecurringTransactions(asOfDate: string)`):**

1. Query all `recurring_rules` where `isActive = 1 AND nextDueDate <= asOfDate`.
2. Wrap per-rule processing inside `db.transaction((tx) => { ... })`:
   - Loop while `rule.nextDueDate <= asOfDate` (cap at max 60 iterations per rule as a safety guard against corrupt dates):
     - Attempt insert into `transactions` (`ON CONFLICT DO NOTHING` against `uidx_transactions_recurring_date`):
       - `date`: rule.nextDueDate
       - `amountCents`: rule.amountCents
       - `currency`: rule.currency
       - `type`: rule.type
       - `categoryId`: rule.categoryId
       - `merchant`: rule.name
       - `paymentMethod`: rule.paymentMethod
       - `notes`: rule.notes
       - `recurringRuleId`: rule.id
     - Update `lastGeneratedDate = rule.nextDueDate`.
     - Advance `rule.nextDueDate` using `advanceDueDate(currentDate, frequency, anchorDay)`:
       - **WEEKLY:** add 7 calendar days.
       - **MONTHLY:** add 1 calendar month, then set day = `Math.min(anchorDay, daysInTargetMonth)`. (Example: anchorDay = 31 → Jan 31 → Feb 28 → Mar 31).
       - **QUARTERLY:** add 3 calendar months, then clamp to anchorDay.
       - **YEARLY:** add 1 calendar year, then clamp to anchorDay (handles Feb 29 → Feb 28 on non-leap years).
   - Persist updated `nextDueDate` and `lastGeneratedDate` to `recurring_rules`.
3. Return `{ generatedCount: number, rulesProcessed: number }`.

**Monthly Normalized Fixed Cost Formula** — for active EXPENSE recurring rules:

- WEEKLY: `amountCents * 52 / 12`
- MONTHLY: `amountCents`
- QUARTERLY: `amountCents / 3`
- YEARLY: `amountCents / 12`

### 3.4 Market Data Service (`src/services/market-data.service.ts`)

Uses `yahoo-finance2` v4 (`new YahooFinance()` singleton).

```ts
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});
```

**Methods & Rules:**

- `searchTickers(query: string)`:
  - Calls `yf.search(query, { quotesCount: 10, newsCount: 0 })`.
  - Filters results where `quoteType` is `'EQUITY' | 'ETF' | 'MUTUALFUND' | 'INDEX'` and `symbol` is present.
  - Maps to `{ ticker, name: shortname || longname || symbol, exchange, typeDisp }`.
- `refreshMarketData({ force = false })`:
  - Stale threshold: `STALE_TTL_MS = 12 * 60 * 60 * 1000` (12 hours).
  - Load `baseCurrency` from settings and all holdings.
  - Identify stale tickers (missing in `stock_prices`, or `now - fetchedAt > STALE_TTL_MS`, or `force === true`).
  - Identify required FX pairs: unique `holding.currency` values where `normalizeCurrency(holding.currency) !== baseCurrency`.
    - Pair key: `` `${from}${baseCurrency}` ``, Yahoo symbol: `` `${from}${baseCurrency}=X` ``.
  - Fetch quotes via `yf.quote(symbols)`. If batch call throws, fall back to sequential `Promise.allSettled` per symbol so one bad ticker never breaks the portfolio.
  - **GBp (Pence) Normalization Edge Case:** London-listed ETFs/stocks sometimes return `currency === "GBp"` or `"GBX"`. Normalize `currency = "GBP"` and divide `closePrice` and `previousClose` by 100 before saving to `stock_prices`.
  - **Price Extraction:**
    - `closePrice = quote.regularMarketPrice ?? quote.regularMarketPreviousClose`
    - `previousClose = quote.regularMarketPreviousClose ?? closePrice`
    - `priceDate = quote.regularMarketTime ? toISODate(quote.regularMarketTime) : todayISODate()`
  - Upsert into `stock_prices` and `fx_rates`.
  - Return `{ updatedTickers: string[], failedTickers: { ticker: string; error: string }[], lastUpdated: string }`.

### 3.5 Portfolio Valuation Math (`src/services/portfolio.service.ts`)

For each holding joined with `stock_prices` and `fx_rates`:

Let `fxRate = holding.currency === baseCurrency ? 1 : (fxRates[`${holding.currency}${baseCurrency}`]?.rate ?? null)`.

**Per-Holding Metrics:**

- `nativeMarketValue = shares * closePrice`
- `baseMarketValue = fxRate !== null ? nativeMarketValue * fxRate : null`
- `dayChangeNative = shares * (closePrice - previousClose)`
- `dayChangeBase = fxRate !== null ? dayChangeNative * fxRate : null`
- `dayChangePercent = previousClose > 0 ? ((closePrice - previousClose) / previousClose) * 100 : 0`
- If `avgCostPerShare !== null`:
  - `costBasisNative = shares * avgCostPerShare`
  - `unrealizedPnlNative = nativeMarketValue - costBasisNative`
  - `unrealizedPnlBase = fxRate !== null ? unrealizedPnlNative * fxRate : null`
  - `unrealizedPnlPercent = costBasisNative > 0 ? (unrealizedPnlNative / costBasisNative) * 100 : null`

**Portfolio Aggregates (in baseCurrency):**

- `totalValueBase = sum(baseMarketValue)`
- `totalDayChangeBase = sum(dayChangeBase)`
- `previousTotalValueBase = totalValueBase - totalDayChangeBase`
- `totalDayChangePercent = previousTotalValueBase > 0 ? (totalDayChangeBase / previousTotalValueBase) * 100 : 0`
- `allocationPercent` per holding `= totalValueBase > 0 ? (baseMarketValue / totalValueBase) * 100 : 0`

### 3.6 Cash Flow & Budget Math (`src/services/cashflow.service.ts`)

- Only transactions in `baseCurrency` are summed directly (if multi-currency transactions exist in the future, flag or convert; v1 defaults all manual cash transactions to `baseCurrency` with optional currency display).
- `TRANSFER` transactions are excluded from `totalIncomeCents` and `totalExpenseCents`.
- `totalIncomeCents = SUM(amountCents WHERE type = 'INCOME')`
- `totalExpenseCents = SUM(amountCents WHERE type = 'EXPENSE')`
- `fixedExpenseCents = SUM(amountCents WHERE type = 'EXPENSE' AND category.isFixed = 1)`
- `variableExpenseCents = totalExpenseCents - fixedExpenseCents`
- `netCashFlowCents = totalIncomeCents - totalExpenseCents`
- `savingsRatePercent = totalIncomeCents > 0 ? ((netCashFlowCents / totalIncomeCents) * 100) : null`

## 4. API Contract Specification

All API routes return JSON. Validation errors return `400` with `{ error: string, issues?: ZodIssue[] }`. Missing resources return `404`. Unexpected errors return `500`.

### 4.1 Dashboard

**`GET /api/dashboard?month=YYYY-MM`**

Runs `syncRecurringTransactions(today)` first. Returns:

- `period`: `{ yearMonth, startDate, endDate }`
- `summary`: `{ totalIncomeCents, totalExpenseCents, fixedExpenseCents, variableExpenseCents, netCashFlowCents, savingsRatePercent }`
- `monthlyTrend`: last 6 billing periods `[{ yearMonth, incomeCents, expenseCents }]`
- `categoryBreakdown`: `[{ categoryId, name, color, amountCents, percentage }]`
- `budgetAlerts`: categories with `monthlyBudgetCents != null` sorted by utilization % descending
- `upcomingBills`: active EXPENSE recurring rules with `nextDueDate` within next 30 days
- `recentTransactions`: latest 8 transactions
- `portfolioSummary`: `{ totalValueBase, dayChangeBase, dayChangePercent, baseCurrency, isStale, lastUpdated }`

### 4.2 Transactions

**`GET /api/transactions`**

- Query params: `startDate`, `endDate`, `type`, `categoryId`, `paymentMethod`, `search`, `limit` (default 100), `offset` (default 0).
- Returns `{ items: TransactionWithCategory[], total: number }`.

**`POST /api/transactions`**

- Body (Zod): `{ date, amountCents (>0), currency?, type, categoryId?, merchant, paymentMethod, notes? }`.
- Rule: `categoryId` required if `type` is `'INCOME'` or `'EXPENSE'`.
- Returns `201` with created record.

**`PATCH /api/transactions/[id]` & `DELETE /api/transactions/[id]`**

- Partial update (Zod) / hard delete.

### 4.3 Recurring Rules

**`GET /api/recurring`**

- Returns `{ rules: RecurringRuleWithCategory[], monthlyFixedExpenseCents: number, monthlyFixedIncomeCents: number }`.

**`POST /api/recurring`**

- Body: `{ name, amountCents, currency?, type, categoryId, paymentMethod, frequency, nextDueDate, notes? }`.
- Sets `anchorDay = Number(nextDueDate.split('-')[2])`.
- Immediately runs `syncRecurringTransactions(today)` if `nextDueDate <= today`.

**`PATCH /api/recurring/[id]` & `DELETE /api/recurring/[id]`**

- Note: Deleting a rule sets `transactions.recurringRuleId = NULL` (ON DELETE SET NULL), preserving historical ledger entries.

**`POST /api/recurring/sync`**

- Manually triggers `syncRecurringTransactions(today)`.

### 4.4 Categories

- `GET /api/categories` — lists non-archived categories (optional `?includeArchived=true`).
- `POST /api/categories` — `{ name, type, groupName, isFixed, monthlyBudgetCents?, color, icon }`.
- `PATCH /api/categories/[id]` — edit name, budget limit, color, isFixed, or archive (`isArchived: true`).
- `DELETE /api/categories/[id]` — allowed only if 0 transactions/rules reference it; otherwise return `409 Conflict` suggesting archival.

### 4.5 Stock Portfolio

**`GET /api/portfolio`**

- Reads `holdings`, `stock_prices`, `fx_rates`, and `settings` strictly from SQLite (never blocks on external network).
- Computes `isStale` boolean (true if any holding lacks a price or `fetchedAt` > 12h).
- Returns `{ holdings: EnrichedHolding[], summary: PortfolioSummary, baseCurrency, isStale, lastUpdated }`.

**`GET /api/portfolio/search?q=apple`**

- Calls `marketDataService.searchTickers(q)`. Minimum 1 char.

**`POST /api/portfolio/holdings`**

- Body: `{ ticker, shares (>0), avgCostPerShare? (>0), notes? }`.
- Fetches quote via `yahoo-finance2` to validate ticker, populate `name`, `exchange`, `currency`, and seed `stock_prices` + `fx_rates` immediately.
- Returns `409` if ticker already exists (prompting user to edit shares instead).

**`PATCH /api/portfolio/holdings/[id]` & `DELETE /api/portfolio/holdings/[id]`**

- Update `shares`, `avgCostPerShare`, `notes` / delete holding.

**`POST /api/portfolio/refresh`**

- Body: `{ force?: boolean }`.
- Calls `refreshMarketData({ force })`, then returns updated portfolio payload + `{ warnings: failedTickers }`.

### 4.6 Settings & CSV Import/Export

- `GET /api/settings` & `PATCH /api/settings` (`{ baseCurrency, monthStartDay }`).
  - If `baseCurrency` changes, trigger background FX refresh for portfolio.
- `GET /api/export/csv?type=transactions|holdings`
  - Streams RFC-4180 CSV with `Content-Disposition: attachment; filename="..."`.
- `POST /api/import/csv`
  - Accepts JSON array of mapped transaction rows (parsed client-side or server-side), validates all rows via Zod inside a single DB transaction, creates missing categories if flagged or maps to existing categories, and returns `{ importedCount }`.

## 5. UI & UX Specification

### 5.1 Navigation & Global Shortcuts

**Sidebar (Desktop) / Bottom Bar (Mobile):**

- Dashboard (`/`)
- Transactions (`/transactions`)
- Subscriptions (`/subscriptions`)
- Budgets (`/budgets`)
- Portfolio (`/portfolio`)
- Settings (`/settings`)

**Global Quick-Add** (Cmd/Ctrl + K or top-right **+ Add Transaction** button):

- Opens modal anywhere in the app with autofocus on Amount → Merchant → Category → Save.
- Defaults date to today, type to EXPENSE.

### 5.2 Non-Blocking Portfolio Refresh Flow

1. User navigates to `/` or `/portfolio`.
2. Page immediately renders cached valuations from SQLite (`GET /api/portfolio`).
3. If `isStale === true`, Client Component automatically fires `POST /api/portfolio/refresh` (`{ force: false }`) with a subtle spinning indicator next to "Last updated: ...".
4. When complete, state updates seamlessly with fresh daily closing prices. If offline/rate-limited, shows a dismissible amber banner: "Could not refresh live prices; showing cached data from [timestamp]."

## 6. Default Seed Data (`src/db/seed.ts`)

Idempotent seed executed only when `categories` table count is 0:

- **Settings:** `id: 1`, `baseCurrency: "EUR"`, `monthStartDay: 1`
- **Expense Categories (Fixed, `isFixed = 1`):**
  - Housing: Rent / Mortgage, Utilities (Electricity/Gas/Water), Internet & Phone
  - Subscriptions: Streaming & Media, Software & Cloud, Gym & Fitness
  - Insurance & Financial: Insurance, Taxes & Bank Fees
- **Expense Categories (Variable, `isFixed = 0`):**
  - Food: Groceries, Restaurants & Takeout, Coffee & Snacks
  - Transport: Public Transit & Fuel, Travel & Flights
  - Personal: Health & Pharmacy, Clothing & Shopping, Entertainment & Hobbies, Other Expense
- **Income Categories:**
  - Salary, Freelance & Bonus, Dividends & Interest, Refunds & Gifts

## 7. Verification & Testing Strategy

### 7.1 Automated Unit & Integration Tests (vitest)

Use an in-memory SQLite database (`new Database(":memory:")`) per test suite with Drizzle migrations applied:

- `tests/recurring.service.test.ts`:
  - Monthly clamping: `anchorDay = 31` advances 2026-01-31 → 2026-02-28 → 2026-03-31.
  - Leap year handling: 2024-02-29 yearly → 2025-02-28.
  - Catch-up generation: rule due 3 months ago generates 3 transactions and advances `nextDueDate` into the future.
  - Idempotency: calling `syncRecurringTransactions` twice on the same day creates zero duplicates.
- `tests/cashflow.service.test.ts`:
  - TRANSFER transactions excluded from Income/Expense totals and Savings Rate.
  - Fixed vs. Variable expense split matches category `isFixed`.
  - Billing period range when `monthStartDay = 25`.
- `tests/portfolio.service.test.ts`:
  - Multi-currency conversion (USD holding converted to EUR base currency via mocked `fx_rates`).
  - GBp (pence) normalization divides price by 100 and converts to GBP.
  - Holdings without `avgCostPerShare` return `unrealizedPnl: null` without NaN.
  - Stale cache detection (> 12h vs < 12h).
- `tests/csv.service.test.ts`:
  - Properly escapes commas, quotes, and newlines in merchant/notes.

### 7.2 Phase Exit Gates (Verification Checklist)

Before marking any Phase complete, Claude Code must pass:

- `npm run typecheck` (`tsc --noEmit`) — 0 errors
- `npm run lint` — 0 errors
- `npm test` (`vitest run`) — all tests passing
- `npm run build` (`next build`) — production build succeeds
