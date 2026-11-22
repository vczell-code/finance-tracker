import { handler, parseBody, requestDb } from "@/lib/api";
import { todayISODate } from "@/lib/dates";
import { recurringCreateSchema } from "@/lib/validation";
import { createRecurringRule, getRecurringRule, listRecurringRules, syncRecurringTransactions } from "@/services/recurring.service";

export const GET = handler(async () => {
  const db = await requestDb();
  syncRecurringTransactions(db, todayISODate());
  return Response.json(listRecurringRules(db));
});

export const POST = handler(async (req: Request) => {
  const db = await requestDb();
  const input = await parseBody(req, recurringCreateSchema);
  const rule = createRecurringRule(db, input);
  const today = todayISODate();
  if (rule.nextDueDate <= today) {
    syncRecurringTransactions(db, today);
    return Response.json(getRecurringRule(db, rule.id), { status: 201 });
  }
  return Response.json(rule, { status: 201 });
});
