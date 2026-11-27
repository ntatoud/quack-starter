import type { User } from "@quack/contracts/identity/user";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { RootBody } from "#/features/layout/root-document.tsx";
import { createPreferences } from "#/features/preferences/preferences.ts";
import { getRouter } from "#/router.tsx";
import { routeTree } from "#/routeTree.gen.ts";

export type ApiHandler = (request: Request) => Response | Promise<Response>;

let handle: ApiHandler = () => {
  throw new Error("renderApp sets how the API answers.");
};

// The API client keeps the `fetch` it first saw, so one stub serves every test and each render sets its handler.
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  handle(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

// The test runs in a page of its own, where the app's `<html>` would render inside a `<div>`: the app renders its body.
Object.assign(routeTree.options, { shellComponent: RootBody });

export const testUser = (overrides: Partial<typeof User.Encoded> = {}): typeof User.Encoded => ({
  id: "user-1",
  email: "someone@quack.dev",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: "2026-01-01T00:00:00.000Z",
  timeZone: "Europe/Paris",
  profile: null,
  ...overrides,
});

const viewports = { desktop: [1280, 800], phone: [375, 800] } as const;

export interface RenderAppOptions {
  readonly api: ApiHandler;
  /** The Current User, `null` for a visitor: a signed-in User by default. */
  readonly currentUser?: typeof User.Encoded | null;
  readonly viewport?: keyof typeof viewports;
}

/**
 * Renders the whole app at `url`, as a User would open it, with the API answered by `api`. The Current User comes in
 * with the page, from the web server, which a test has not: it is given.
 */
export const renderApp = async (
  url: string,
  { api, currentUser = testUser(), viewport = "desktop" }: RenderAppOptions,
) => {
  handle = api;
  fetch.mockClear();
  const [width, height] = viewports[viewport];
  await page.viewport(width, height);

  const router = getRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    preferences: createPreferences(),
  });

  const { queryClient } = router.options.context;
  // A request that fails fails at once: the retries of the app would only slow the test down.
  queryClient.setDefaultOptions({ queries: { retry: false } });
  queryClient.setQueryData(currentUserQueryOptions.queryKey, currentUser);

  await router.load();
  await render(<RouterProvider router={router} />);

  return { router, queryClient, fetch };
};
