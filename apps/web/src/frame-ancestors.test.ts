import { describe, expect, it } from "vite-plus/test";

import { routeTree } from "#/routeTree.gen.ts";

describe("the response of every page", () => {
  it("forbids any site to frame it, so no page is approved under a decoy", async () => {
    const headers = await routeTree.options.headers?.({} as never);

    expect(headers).toEqual({ "Content-Security-Policy": "frame-ancestors 'none'" });
  });
});
