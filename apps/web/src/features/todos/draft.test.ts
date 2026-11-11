import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { parseDraftTitle } from "#/features/todos/draft.ts";

describe("parseDraftTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(Option.getOrNull(parseDraftTitle("  Ship it  "))).toBe("Ship it");
  });

  it("rejects blank and overlong drafts", () => {
    expect(Option.isNone(parseDraftTitle("   "))).toBe(true);
    expect(Option.isNone(parseDraftTitle("x".repeat(121)))).toBe(true);
  });
});
