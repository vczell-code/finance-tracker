import { connection } from "next/server";
import { z } from "zod";
import { HttpError, handler, parseQuery } from "@/lib/api";
import { searchTickers } from "@/services/market-data.service";

export const GET = handler(async (req: Request) => {
  await connection();
  const { q } = parseQuery(req, z.object({ q: z.string().trim().min(1, "Query must be at least 1 character") }));
  try {
    return Response.json({ results: await searchTickers(q) });
  } catch (e) {
    throw new HttpError(502, `Ticker search failed: ${e instanceof Error ? e.message : String(e)}`);
  }
});
