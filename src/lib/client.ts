"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
  }
}

/** JSON fetch helper that throws ApiError with the server's `error` message. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError((body as { error?: string } | null)?.error ?? `Request failed (${res.status})`, res.status, body);
  }
  return body as T;
}

const DATA_CHANGED = "finance:data-changed";

/** Notify all mounted views that server data changed (e.g. after Quick Add). */
export function emitDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED));
}

export function onDataChanged(cb: () => void): () => void {
  window.addEventListener(DATA_CHANGED, cb);
  return () => window.removeEventListener(DATA_CHANGED, cb);
}

/** Categorical slots (reference palette, light mode) — fixed order, never cycled. */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const OTHER_COLOR = "#a3a3a3";
