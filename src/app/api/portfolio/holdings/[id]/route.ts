import { handler, notFound, parseBody, parseId, requestDb } from "@/lib/api";
import { holdingUpdateSchema } from "@/lib/validation";
import { deleteHolding, updateHolding } from "@/services/portfolio.service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const db = await requestDb();
  const id = await parseId(params);
  const input = await parseBody(req, holdingUpdateSchema);
  const h = updateHolding(db, id, input);
  if (!h) throw notFound("Holding");
  return Response.json(h);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const db = await requestDb();
  if (!deleteHolding(db, await parseId(params))) throw notFound("Holding");
  return new Response(null, { status: 204 });
});
