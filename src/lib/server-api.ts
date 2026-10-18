import "server-only";
import { hc } from "hono/client";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import type { App } from "@/server/app";
import { getApp } from "@/server/instance";
import { unwrap, ApiError } from "./api";

// Server components call the same Hono app, in process, with the visitor's
// cookies. No network hop, and every page goes through the API's checks.
export async function serverApi() {
  // Data from the API always depends on the request (the visitor, the clock,
  // the database), so it renders at request time inside a Suspense boundary.
  await connection();
  const cookie = (await cookies()).toString();
  const app = await getApp();
  return hc<App>("http://internal", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init),
    headers: { cookie },
  });
}

// unwrap, plus the page-level reactions: 404s show the not-found page and
// 401s send you to log in and back.
export async function load<R extends Parameters<typeof unwrap>[0] extends Promise<infer X> ? X : never>(
  request: Promise<R>,
  { returnTo }: { returnTo?: string } = {},
) {
  try {
    return await unwrap(request);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
    }
    throw err;
  }
}

export async function currentUser() {
  const client = await serverApi();
  const { user } = await unwrap(client.api.auth.me.$get());
  return user;
}
