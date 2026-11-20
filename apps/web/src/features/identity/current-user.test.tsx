import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { currentUserQueryOptions, setCurrentUserData } from "#/features/identity/current-user.ts";
import { preferencesQueryKey } from "#/features/preferences/preferences-store.ts";

describe("setCurrentUserData", () => {
  it("drops the queries of the User before, and keeps the Preferences of the device", () => {
    const queryClient = new QueryClient();
    const preferences = { "right-sidebar": true };
    queryClient.setQueryData(preferencesQueryKey, preferences);
    queryClient.setQueryData(["todos"], ["Ship it"]);

    setCurrentUserData(queryClient, null);

    expect(queryClient.getQueryData(["todos"])).toBeUndefined();
    expect(queryClient.getQueryData(preferencesQueryKey)).toEqual(preferences);
    expect(queryClient.getQueryData(currentUserQueryOptions.queryKey)).toBeNull();
  });
});
