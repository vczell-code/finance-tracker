import { handler, notFound, parseBody, parseId, requestDb } from "@/lib/api";
import { transactionUpdateSchema } from "@/lib/validation";
import { deleteTransaction, getTransaction, updateTransaction } from "@/services/transactions.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const db = await requestDb();
  const tx = getTransaction(db, await parseId(params));
  if (!tx) throw notFound("Transaction");
  return Response.json(tx);
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const db = await requestDb();
  const id = await parseId(params);
  const input = await parseBody(req, transactionUpdateSchema);
  const tx = updateTransaction(db, id, input);
  if (!tx) throw notFound("Transaction");
  return Response.json(tx);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const db = await requestDb();
  if (!deleteTransaction(db, await parseId(params))) throw notFound("Transaction");
  return new Response(null, { status: 204 });
});
