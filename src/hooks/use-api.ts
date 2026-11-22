"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, onDataChanged } from "@/lib/client";

/** Fetches JSON from `url` (null = skip), re-fetching whenever data changes app-wide. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await apiFetch<T>(url);
      if (id === reqId.current) {
        setData(res);
        setError(null);
      }
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on mount/url change
    void load();
    return onDataChanged(() => void load());
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
