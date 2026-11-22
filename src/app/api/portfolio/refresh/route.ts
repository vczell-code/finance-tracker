import { z } from "zod";
import { HttpError, handler, requestDb } from "@/lib/api";
import { refreshMarketData } from "@/services/market-data.service";
import { getPortfolio } from "@/services/portfolio.service";

const bodySchema = z.object({ force: z.boolean().optional() });

export const POST = handler(async (req: Request) => {
  const db = await requestDb();
  const text = await req.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const { force } = bodySchema.parse(json);
  const result = await refreshMarketData(db, { force: force ?? false });
  return Response.json({ ...getPortfolio(db), warnings: result.failedTickers, updatedTickers: result.updatedTickers });
});
