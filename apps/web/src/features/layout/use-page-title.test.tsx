import { afterEach, describe, expect, it } from "vite-plus/test";
import { renderHook } from "vitest-browser-react";

import { pageTitle } from "#/features/layout/page-title.ts";
import { usePageTitle } from "#/features/layout/use-page-title.ts";

const before = document.title;

afterEach(() => {
  document.title = before;
});

describe("usePageTitle", () => {
  it("keeps the title of the route until the data is loaded, then titles the page with it", async () => {
    document.title = pageTitle("User", "Users");

    const { rerender } = await renderHook<{ name?: string }, void>(
      ({ name }: { name?: string } = {}) => usePageTitle(name, "Users"),
      { initialProps: {} },
    );

    expect(document.title).toBe(pageTitle("User", "Users"));

    await rerender({ name: "Ada Lovelace" });

    expect(document.title).toBe(pageTitle("Ada Lovelace", "Users"));
  });
});
