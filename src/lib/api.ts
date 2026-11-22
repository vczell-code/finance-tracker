import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { getDb, type DB } from "@/db";

/**
 * better-sqlite3 is synchronous, so its queries would otherwise run during
 * prerendering. connection() defers to request time (see Next docs: connection).
 */
export async function requestDb(): Promise<DB> {
  await connection();
  return getDb();
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message ?? "Validation failed", { issues: result.error.issues });
  }
  return result.data;
}

export function parseQuery<T extends z.ZodType>(req: Request, schema: T): z.infer<T> {
  const params = Object.fromEntries(
    [...new URL(req.url).searchParams.entries()].filter(([, v]) => v !== ""),
  );
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message ?? "Invalid query", { issues: result.error.issues });
  }
  return result.data;
}

export async function parseId(params: Promise<{ id: string }>): Promise<number> {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid id");
  return n;
}

function isSqliteConstraint(e: unknown): e is Error & { code: string } {
  const code = e instanceof Error ? (e as Error & { code?: unknown }).code : undefined;
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT");
}

/** Wrap a handler: maps HttpError/Zod/SQLite errors to JSON responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      unstable_rethrow(e); // let Next.js internal signals (e.g. prerender abort) through
      if (e instanceof HttpError) {
        return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      }
      if (e instanceof z.ZodError) {
        return Response.json({ error: e.issues[0]?.message ?? "Validation failed", issues: e.issues }, { status: 400 });
      }
      const status = (e as { status?: unknown })?.status;
      if (typeof status === "number" && status >= 400 && status < 600) {
        return Response.json({ error: (e as Error).message }, { status });
      }
      if (isSqliteConstraint(e)) {
        const conflict = e.code === "SQLITE_CONSTRAINT_UNIQUE" || e.code === "SQLITE_CONSTRAINT_PRIMARYKEY";
        const msg = e.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ? "Referenced record does not exist or is in use" : e.message;
        return Response.json({ error: msg }, { status: conflict ? 409 : 400 });
      }
      console.error(e);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
