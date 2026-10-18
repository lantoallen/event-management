import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite loads its own WebAssembly files, so it runs from node_modules
  // instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The in-memory demo database runs the SQL migrations when a server starts,
  // so they have to ship with the deployed functions.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
