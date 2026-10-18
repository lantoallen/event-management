import { getApp } from "@/server/instance";

// Every /api request goes to the Hono app in src/server.
async function handler(request: Request) {
  const app = await getApp();
  return app.fetch(request);
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
