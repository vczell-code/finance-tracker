import { handler, notFound, parseBody, parseId, requestDb } from "@/lib/api";
import { todayISODate } from "@/lib/dates";
import { recurringUpdateSchema } from "@/lib/validation";
import {
  deleteRecurringRule,
  getRecurringRule,
  syncRecurringTransactions,
  updateRecurringRule,
} from "@/services/recurring.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const db = await requestDb();
  const rule = getRecurringRule(db, await parseId(params));
  if (!rule) throw notFound("Recurring rule");
  return Response.json(rule);
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const db = await requestDb();
  const id = await parseId(params);
  const input = await parseBody(req, recurringUpdateSchema);
  const rule = updateRecurringRule(db, id, input);
  if (!rule) throw notFound("Recurring rule");
  const today = todayISODate();
  if (rule.isActive && rule.nextDueDate <= today) {
    syncRecurringTransactions(db, today);
    return Response.json(getRecurringRule(db, id));
  }
  return Response.json(rule);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const db = await requestDb();
  if (!deleteRecurringRule(db, await parseId(params))) throw notFound("Recurring rule");
  return new Response(null, { status: 204 });
});
