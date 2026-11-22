import { after } from "next/server";
import { handler, parseBody, requestDb } from "@/lib/api";
import { settingsUpdateSchema } from "@/lib/validation";
import { refreshMarketData } from "@/services/market-data.service";
import { getSettings, updateSettings } from "@/services/settings.service";

export const GET = handler(async () => {
  const db = await requestDb();
  return Response.json(getSettings(db));
});

export const PATCH = handler(async (req: Request) => {
  const db = await requestDb();
  const input = await parseBody(req, settingsUpdateSchema);
  const before = getSettings(db);
  const updated = updateSettings(db, input);
  if (updated.baseCurrency !== before.baseCurrency) {
    // Fetch FX pairs for the new base currency without blocking the response.
    after(async () => {
      try {
        await refreshMarketData(db, { force: false });
      } catch (e) {
        console.error("Background FX refresh failed", e);
      }
    });
  }
  return Response.json(updated);
});
