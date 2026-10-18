import { describe, expect, it } from "vitest";
import { cleanConnectionString } from "../db/client";

describe("connection string", () => {
  it("drops channel_binding from a Neon URL and keeps everything else", () => {
    const url =
      "postgresql://user:p%40ss@ep-cool-name-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
    const cleaned = new URL(cleanConnectionString(url));
    expect(cleaned.searchParams.has("channel_binding")).toBe(false);
    expect(cleaned.searchParams.get("sslmode")).toBe("require");
    expect(cleaned.password).toBe("p%40ss");
    expect(cleaned.hostname).toBe("ep-cool-name-pooler.ap-southeast-1.aws.neon.tech");
    expect(cleaned.pathname).toBe("/neondb");
  });

  it("leaves URLs without it alone", () => {
    expect(cleanConnectionString("postgres://postgres:postgres@localhost:5432/events_test")).toBe(
      "postgres://postgres:postgres@localhost:5432/events_test",
    );
  });
});
