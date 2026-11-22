import { handler, requestDb } from "@/lib/api";
import { todayISODate } from "@/lib/dates";
import { syncRecurringTransactions } from "@/services/recurring.service";

export const POST = handler(async () => {
  const db = await requestDb();
  return Response.json(syncRecurringTransactions(db, todayISODate()));
});
