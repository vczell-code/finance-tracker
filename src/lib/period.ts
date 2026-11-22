import { addDays, daysInMonth, makeISODate, parseISODate, shiftYearMonth } from "./dates";

/**
 * Billing period for a "YYYY-MM" label.
 * monthStartDay = 1  -> calendar month.
 * monthStartDay = 25 -> "2026-11" runs 2026-10-25 .. 2026-11-24.
 */
export function getBillingPeriodRange(
  yearMonth: string,
  monthStartDay: number,
): { startDate: string; endDate: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  if (monthStartDay <= 1) {
    return { startDate: makeISODate(y, m, 1), endDate: makeISODate(y, m, daysInMonth(y, m)) };
  }
  const [py, pm] = shiftYearMonth(yearMonth, -1).split("-").map(Number);
  return {
    startDate: makeISODate(py, pm, monthStartDay),
    endDate: addDays(makeISODate(y, m, monthStartDay), -1),
  };
}

/** The billing period label ("YYYY-MM") a given date falls into. */
export function getYearMonthForDate(date: string, monthStartDay: number): string {
  const { y, m, d } = parseISODate(date);
  const ym = makeISODate(y, m, 1).slice(0, 7);
  if (monthStartDay > 1 && d >= monthStartDay) return shiftYearMonth(ym, 1);
  return ym;
}
