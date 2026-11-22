import { z } from "zod";
import { handler, parseQuery, requestDb } from "@/lib/api";
import { yearMonth } from "@/lib/validation";
import { getDashboard } from "@/services/dashboard.service";

export const GET = handler(async (req: Request) => {
  const db = await requestDb();
  const { month } = parseQuery(req, z.object({ month: yearMonth.optional() }));
  return Response.json(getDashboard(db, month));
});
