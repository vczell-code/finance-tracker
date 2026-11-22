import { handler, parseBody, requestDb } from "@/lib/api";
import { holdingCreateSchema } from "@/lib/validation";
import { addHolding } from "@/services/portfolio.service";

export const POST = handler(async (req: Request) => {
  const db = await requestDb();
  const input = await parseBody(req, holdingCreateSchema);
  return Response.json(await addHolding(db, input), { status: 201 });
});
