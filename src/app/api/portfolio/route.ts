import { handler, requestDb } from "@/lib/api";
import { getPortfolio } from "@/services/portfolio.service";

/** Reads cached valuations from SQLite only — never blocks on the network. */
export const GET = handler(async () => {
  const db = await requestDb();
  return Response.json(getPortfolio(db));
});
