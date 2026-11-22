import { HttpError, handler, parseBody, requestDb } from "@/lib/api";
import { csvImportSchema } from "@/lib/validation";
import { ImportError, importTransactions } from "@/services/csv-db.service";

export const POST = handler(async (req: Request) => {
  const db = await requestDb();
  const { rows, createMissingCategories } = await parseBody(req, csvImportSchema);
  try {
    return Response.json(importTransactions(db, rows, createMissingCategories), { status: 201 });
  } catch (e) {
    if (e instanceof ImportError) throw new HttpError(400, e.message, { row: e.row });
    throw e;
  }
});
