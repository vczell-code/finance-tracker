const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, fractionDigits?: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits ?? "d"}`;
  let f = currencyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      ...(fractionDigits !== undefined
        ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }
        : {}),
    });
    currencyFormatters.set(key, f);
  }
  return f;
}

export function formatCents(cents: number, currency = "EUR"): string {
  return currencyFormatter(currency).format(cents / 100);
}

export function formatMoney(amount: number | null | undefined, currency = "EUR", fractionDigits?: number): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  return currencyFormatter(currency, fractionDigits).format(amount);
}

export function formatSignedMoney(amount: number | null | undefined, currency = "EUR"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const s = formatMoney(Math.abs(amount), currency);
  return amount > 0 ? `+${s}` : amount < 0 ? `-${s}` : s;
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1, signed = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const s = `${Math.abs(value).toFixed(fractionDigits)}%`;
  if (!signed) return value < 0 ? `-${s}` : s;
  return value > 0 ? `+${s}` : value < 0 ? `-${s}` : s;
}

export function formatNumber(n: number, maxFractionDigits = 4): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatYearMonth(yearMonth: string, long = false): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: long ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** "12.34" -> 1234 */
export function toCents(decimalInput: string | number): number {
  return Math.round(Number(decimalInput) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  DEBIT: "Debit card",
  CREDIT: "Credit card",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  OTHER: "Other",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};
