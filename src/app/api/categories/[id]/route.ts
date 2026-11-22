import { HttpError, handler, notFound, parseBody, parseId, requestDb } from "@/lib/api";
import { categoryUpdateSchema } from "@/lib/validation";
import { deleteCategory, updateCategory } from "@/services/categories.service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const db = await requestDb();
  const id = await parseId(params);
  const input = await parseBody(req, categoryUpdateSchema);
  const cat = updateCategory(db, id, input);
  if (!cat) throw notFound("Category");
  return Response.json(cat);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const db = await requestDb();
  const res = deleteCategory(db, await parseId(params));
  if (!res.ok && res.reason === "not_found") throw notFound("Category");
  if (!res.ok) {
    throw new HttpError(409, `Category is used by ${res.references} transaction(s) or rule(s). Archive it instead.`, {
      suggestion: "archive",
    });
  }
  return new Response(null, { status: 204 });
});
