import { hc } from "hono/client";
import type { App } from "@/server/app";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> };
type Body<R extends JsonResponse> = Awaited<ReturnType<R["json"]>>;

// Returns the parsed body, or throws an ApiError carrying the server's message.
export async function unwrap<R extends JsonResponse>(request: Promise<R>): Promise<Body<R>> {
  const res = await request;
  const data = (await res.json().catch(() => null)) as { error?: { message: string; code: string } } | null;
  if (!res.ok) {
    throw new ApiError(data?.error?.message ?? "Something went wrong. Try again.", res.status, data?.error?.code ?? "unknown");
  }
  return data as Body<R>;
}

// Typed client for the browser. Same routes and types as the server, so a
// renamed field breaks the build instead of the page.
export const api = hc<App>(typeof window === "undefined" ? "http://localhost" : window.location.origin);

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : "Something went wrong. Check your connection and try again.";
