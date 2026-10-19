import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeRedirectPath("/events/open-mic-night")).toBe("/events/open-mic-night");
    expect(safeRedirectPath("/events?category=food#top")).toBe("/events?category=food#top");
  });

  it("refuses anything that leads to another site", () => {
    for (const value of [
      "//evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "\\\\evil.com",
      "https://evil.com/login",
      "http:evil.com",
      "javascript:alert(1)",
      " //evil.com",
    ]) {
      expect(safeRedirectPath(value), value).toBeNull();
    }
  });

  it("returns nothing for empty input", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
  });
});
