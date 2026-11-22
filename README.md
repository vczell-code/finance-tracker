# Finance — Personal Finance & Portfolio Tracker

Local-first Next.js 16 app (App Router, Cache Components) with SQLite (better-sqlite3 + Drizzle) and
end-of-day stock prices from Yahoo Finance (`yahoo-finance2` v4).

Requires **Node.js ≥ 22**.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

The database (`./data/finance.db`, override with `DATABASE_PATH`) is created, migrated and seeded with
default categories automatically on first request. To do it manually: `npm run db:seed`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (in-memory SQLite) |
| `npm run db:generate` | Generate a new Drizzle migration after editing `src/db/schema.ts` |
| `npm run db:seed` | Migrate + seed the database |

## Features

- **Dashboard** — monthly income/expense/net/savings rate, 6-period cash-flow chart, spending by category,
  budget alerts, upcoming bills, recent transactions, portfolio summary.
- **Transactions** — filterable ledger (search, type, category, method, date range), edit/delete, CSV export.
- **Subscriptions** — recurring rules (weekly/monthly/quarterly/yearly) that auto-generate transactions
  idempotently, with month-end clamping (31st → 28th Feb → 31st Mar). Monthly fixed-burn totals.
- **Budgets** — per-category monthly limits with inline editing and utilisation status.
- **Portfolio** — holdings with live ticker search, multi-currency valuation (FX via Yahoo), GBp→GBP
  normalisation, day change, unrealised P&L, allocation. Cached prices render instantly; stale (>12h)
  prices refresh in the background.
- **Settings** — base currency, billing-period start day (e.g. payday on the 25th), category management
  (archive instead of delete when in use), CSV import/export.
- **Quick add** — `Ctrl/⌘ + K` anywhere.

## Structure

```
src/db/          schema, connection (WAL, FKs), seed
src/lib/         dates, billing period math, formatting, Zod validation, API helpers
src/services/    cashflow, recurring, market-data, portfolio, csv, dashboard (pure, DB-injected, unit-tested)
src/app/api/     REST route handlers
src/app/*        pages (client components fetching /api)
tests/           vitest suites
drizzle/         generated SQL migrations
```
