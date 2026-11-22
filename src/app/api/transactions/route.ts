import { handler, parseBody, parseQuery, requestDb } from "@/lib/api";
import { transactionCreateSchema, transactionQuerySchema } from "@/lib/validation";
import { createTransaction, listTransactions } from "@/services/transactions.service";

export const GET = handler(async (req: Request) => {
  const db = await requestDb();
  const q = parseQuery(req, transactionQuerySchema);
  return Response.json(listTransactions(db, q));
});

export const POST = handler(async (req: Request) => {
  const db = await requestDb();
  const input = await parseBody(req, transactionCreateSchema);
  return Response.json(createTransaction(db, input), { status: 201 });
});
