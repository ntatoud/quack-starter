import type { Role } from "@quack/contracts/identity/user";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { routeTree } from "#/routeTree.gen.ts";
import { testProviders } from "#/testing/test-providers.tsx";

const landingOf = async (path: string, who: Role | "visitor") => {
  const { queryClient } = testProviders();
  queryClient.setQueryData(
    currentUserQueryOptions.queryKey,
    who === "visitor"
      ? null
      : {
          id: "user-1",
          email: "someone@quack.dev",
          role: who,
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastSignInAt: null,
          onboardedAt: "2026-01-01T00:00:00.000Z",
          profile: null,
        },
  );

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  await router.load();

  return router.state.location.pathname;
};

describe("the roots of the app", () => {
  it.each([
    ["/", "user", "/app"],
    ["/", "admin", "/app"],
    ["/app", "admin", "/app"],
    ["/app/settings", "user", "/app/settings"],
    ["/admin", "admin", "/admin/users"],
    ["/admin", "user", "/app"],
    ["/admin/users", "user", "/app"],
    ["/app", "visitor", "/sign-in"],
    ["/admin/users", "visitor", "/sign-in"],
  ] as const)("lead %s, for a %s, to %s", async (path, who, landing) => {
    expect(await landingOf(path, who)).toBe(landing);
  });
});
