"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import type { PortfolioPayload, PortfolioRefreshPayload } from "@/lib/types";
import { useApi } from "./use-api";

/**
 * Non-blocking portfolio flow (spec §5.2): render cached SQLite valuations immediately,
 * then if stale fire a background refresh and swap in fresh prices when it lands.
 */
export function usePortfolio() {
  const api = useApi<PortfolioPayload>("/api/portfolio");
  const { data, setData } = api;
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const autoTried = useRef(false);

  const refresh = useCallback(
    async (force = false) => {
      setRefreshing(true);
      try {
        const res = await apiFetch<PortfolioRefreshPayload>("/api/portfolio/refresh", { method: "POST", json: { force } });
        setData(res);
        if (res.warnings.length > 0) {
          const list = res.warnings.map((w) => w.ticker).join(", ");
          setWarning(
            res.updatedTickers.length === 0
              ? `Could not refresh live prices; showing cached data from ${formatDateTime(res.lastUpdated)}. (${list})`
              : `Some prices could not be refreshed: ${list}. Showing cached data for those.`,
          );
        } else {
          setWarning(null);
        }
      } catch {
        setWarning(`Could not refresh live prices; showing cached data from ${formatDateTime(data?.lastUpdated)}.`);
      } finally {
        setRefreshing(false);
      }
    },
    [data?.lastUpdated, setData],
  );

  useEffect(() => {
    if (data?.isStale && !autoTried.current) {
      autoTried.current = true;
      void refresh(false);
    }
  }, [data?.isStale, refresh]);

  return { ...api, refreshing, refresh, warning, dismissWarning: () => setWarning(null) };
}
