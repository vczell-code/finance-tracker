import { z } from "zod";
import { handler, parseBody, parseQuery, requestDb } from "@/lib/api";
import { categoryCreateSchema } from "@/lib/validation";
import { createCategory, listCategories } from "@/services/categories.service";

export const GET = handler(async (req: Request) => {
  const db = await requestDb();
  const { includeArchived } = parseQuery(req, z.object({ includeArchived: z.enum(["true", "false"]).optional() }));
  return Response.json(listCategories(db, includeArchived === "true"));
});

export const POST = handler(async (req: Request) => {
  const db = await requestDb();
  const input = await parseBody(req, categoryCreateSchema);
  return Response.json(createCategory(db, input), { status: 201 });
});
