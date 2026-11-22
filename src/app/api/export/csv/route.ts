import { z } from "zod";
import { handler, parseQuery, requestDb } from "@/lib/api";
import { todayISODate } from "@/lib/dates";
import { exportHoldingsCsv, exportTransactionsCsv } from "@/services/csv-db.service";

export const GET = handler(async (req: Request) => {
  const db = await requestDb();
  const { type } = parseQuery(req, z.object({ type: z.enum(["transactions", "holdings"]).default("transactions") }));
  const csv = type === "holdings" ? exportHoldingsCsv(db) : exportTransactionsCsv(db);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${todayISODate()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
