import type { Role } from "@quack/contracts/identity/user";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { routeTree } from "#/routeTree.gen.ts";
import { testProviders } from "#/testing/test-providers.tsx";

const routerAt = async (path: string, who: Role | "visitor") => {
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
          timeZone: "Europe/Paris",
          profile: null,
        },
  );

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  await router.load();

  return router.state.location;
};

const landingOf = async (path: string, who: Role | "visitor") =>
  (await routerAt(path, who)).pathname;

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

const paramsOf = (search: string) => [...new URLSearchParams(search)];

describe("the authorization page of an AI Client", () => {
  // As AI Clients write it: a state that reads as a number, a scope with a space, URLs as values.
  const authorize =
    "/oauth/authorize?response_type=code&client_id=https%3A%2F%2Fclaude.ai%2Foauth%2Fclient.json" +
    "&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&state=00123" +
    "&scope=todos%3Alist%20todos%3Awrite&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

  it("sends a visitor to sign in, and back to the whole authorization URL", async () => {
    const signIn = await routerAt(authorize, "visitor");

    expect(signIn.pathname).toBe("/sign-in");
    const redirect = new URLSearchParams(signIn.searchStr).get("redirect") ?? "";
    const back = await routerAt(`/sign-in?${new URLSearchParams({ redirect })}`, "user");

    expect(back.pathname).toBe("/oauth/authorize");
    expect(paramsOf(back.searchStr)).toEqual(paramsOf(authorize.split("?")[1] ?? ""));
  });

  it("stays for a signed-in User", async () => {
    const location = await routerAt(authorize, "user");

    expect(location.pathname).toBe("/oauth/authorize");
    expect(paramsOf(location.searchStr)).toEqual(paramsOf(authorize.split("?")[1] ?? ""));
  });
});
