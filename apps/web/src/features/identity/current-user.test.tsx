import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { currentUserQueryOptions, setCurrentUserData } from "#/features/identity/current-user.ts";

describe("setCurrentUserData", () => {
  it("drops the queries of the User before", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["todos"], ["Ship it"]);

    setCurrentUserData(queryClient, null);

    expect(queryClient.getQueryData(["todos"])).toBeUndefined();
    expect(queryClient.getQueryData(currentUserQueryOptions.queryKey)).toBeNull();
  });
});
