# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Local-first personal finance & stock portfolio tracker: Next.js 16 (App Router, `cacheComponents: true`), React 19, SQLite via better-sqlite3 + Drizzle, Tailwind v4 + shadcn/ui, Yahoo Finance (`yahoo-finance2` v4) for end-of-day prices/FX. Requires Node ≥ 22. `SPEC.md` is the authoritative technical spec (schema, algorithms, API contract, test plan) — check it before changing domain behaviour.

## Commands

```bash
npm run dev                 # http://localhost:3000
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
npm test                    # vitest run (in-memory SQLite)
npx vitest run tests/recurring.service.test.ts       # single file
npx vitest run -t "<test name substring>"            # single test by name
npm run build
npm run db:generate         # new Drizzle migration after editing src/db/schema.ts
npm run db:seed             # migrate + seed the database
npm run db:backup           # timestamped snapshot into <db folder>/backups (or BACKUP_DIR)
```

Verification gate after changes (SPEC §7.2): `npm run typecheck && npm run lint && npm test && npm run build`.

## Architecture

Request flow: **client page → `/api/*` route handler → service function → Drizzle/SQLite**.

- **Pages (`src/app/*/page.tsx`) are client components** that fetch JSON from `/api` via `useApi(url)` (`src/hooks/use-api.ts`). After a mutation, call `emitDataChanged()` (`src/lib/client.ts`); every mounted `useApi` re-fetches on that window event. This is how Quick Add (Ctrl/⌘+K, `quick-add-command-dialog.tsx`) refreshes whatever page is open.
- **Route handlers** are thin and all follow the same shape (see `src/app/api/transactions/route.ts`): wrap in `handler()`, get the DB with `await requestDb()`, validate with `parseBody`/`parseQuery`/`parseId` against Zod schemas from `src/lib/validation.ts`, call a service. `handler()` (`src/lib/api.ts`) maps `HttpError`, `ZodError` and SQLite constraint errors to JSON `{ error }` responses (UNIQUE → 409, FK → 400). Throw `HttpError`/`notFound()` rather than building error responses manually.
- **`requestDb()` must be used in route handlers, not `getDb()` directly**: better-sqlite3 is synchronous, so `await connection()` is needed to defer DB access to request time under Cache Components; otherwise queries run during prerender.
- **Services (`src/services/*.service.ts`)** hold all business logic as plain functions taking `db: DB` as the first argument (DB-injected, no Next.js imports). This is what makes them unit-testable.
- **DB (`src/db/index.ts`)**: `createDb(path)` opens SQLite with WAL/FKs/busy_timeout and runs migrations from `./drizzle`; `getDb()` is a `globalThis` singleton that also seeds default categories on first use. DB path comes from `databasePath()` in `src/db/config.ts`: `DATABASE_PATH` (set in `.env.local`) or `./data/finance.db`. Next loads `.env.local` itself; standalone scripts (`seed-cli`, `backup-cli`, `drizzle.config.ts`) must call `loadLocalEnv()` first.
- **Tests** (`tests/*.test.ts`) use `createTestDb()` from `tests/helpers/test-db.ts` — a fresh migrated + seeded `:memory:` DB per test — and call services directly. Market data is injected via the `QuoteProvider` interface (`market-data.service.ts`), so tests stub it instead of hitting Yahoo.

## Domain rules that span files

- **Money**: transaction/budget/recurring amounts are positive integer `amountCents`; direction comes from the transaction type. Never use floats for cash-flow sums. Stock quantities/prices/FX are REAL and only rounded at presentation (`src/lib/format.ts`).
- **Billing periods**: "month" means billing period from `src/lib/period.ts` (`getBillingPeriodRange`) using the `monthStartDay` setting — with start day 25, period `2026-11` is 2026-10-25..2026-11-24. Use it for anything month-scoped (dashboard, budgets, cash flow).
- **Base currency**: cash-flow totals only include transactions in the settings' base currency (per spec).
- **Recurring rules** generate transactions idempotently up to today in `syncRecurringTransactions` (called from the recurring API routes and `/api/recurring/sync`), with month-end clamping via `anchorDay` (31st → 28 Feb → 31 Mar).
- **Portfolio prices**: cached in SQLite; `GET /api/portfolio` returns cached valuations plus `isStale` (>12h, `STALE_TTL_MS`), and the client then fires `POST /api/portfolio/refresh` in the background (`src/hooks/use-portfolio.ts`). Refresh failures must degrade to cached data with a warning, not an error. GBp/GBX quotes are normalised to GBP (÷100) in `normalizeQuote`.
- **Categories** that are referenced are archived rather than deleted.

## Environment caveats

- `dev`/`start` bind to `127.0.0.1` on purpose (the app has no auth) — don't remove `-H 127.0.0.1`.
- The repo lives in OneDrive, so the live DB is kept outside it via `DATABASE_PATH` in `.env.local`; don't move it back into the repo folder.

- The repo lives in OneDrive. If `next build` fails with `EPERM` on `.next`, delete `.next` and rebuild.
- Stopping a backgrounded `next start`/`next dev` may leave the node process holding port 3000; kill it by port (`Get-NetTCPConnection -LocalPort 3000`).
