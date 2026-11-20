import { User } from "@quack/contracts/identity/user";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Schema } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { AuthenticatedLayout } from "#/features/layout/authenticated-layout.tsx";

const newcomer = {
  id: "user-1",
  email: "ada@example.com",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: null,
  profile: null,
} as const;

const onboarded = {
  ...newcomer,
  onboardedAt: "2026-01-01T00:05:00.000Z",
  profile: {
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    jobTitle: "",
    team: null,
    country: null,
  },
} as const;

/** A Profile does not make a User onboarded: an Admin may have filled it in before they signed in. */
const notYetOnboarded = { ...onboarded, onboardedAt: null } as const;

vi.stubGlobal(
  "fetch",
  vi.fn(async () => Response.json(onboarded)),
);

const setup = async (currentUser: typeof newcomer | typeof onboarded | typeof notYetOnboarded) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(currentUserQueryOptions.queryKey, currentUser);
  const rootRoute = createRootRoute();
  const authenticated = createRoute({
    getParentRoute: () => rootRoute,
    id: "_authenticated",
    beforeLoad: () => ({
      currentUser: Schema.decodeSync(User)(
        queryClient.getQueryData(currentUserQueryOptions.queryKey) ?? newcomer,
      ),
    }),
    component: AuthenticatedLayout,
  });
  const app = createRoute({
    getParentRoute: () => authenticated,
    path: "app",
    component: () => <button type="button">A page of the app</button>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([authenticated.addChildren([app])]),
    history: createMemoryHistory({ initialEntries: ["/app"] }),
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe("AuthenticatedLayout", () => {
  it("shows the page to an onboarded User, with no onboarding", async () => {
    await setup(onboarded);

    await expect.element(page.getByRole("button", { name: "A page of the app" })).toBeVisible();
    expect(page.getByRole("dialog").elements()).toEqual([]);
  });

  it("keeps the page out of reach of a User with no Profile, behind the onboarding", async () => {
    await setup(newcomer);

    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect.element(page.getByText("Signed in as ada@example.com")).toBeVisible();
    expect(page.getByRole("button", { name: "A page of the app" }).elements()).toEqual([]);
  });

  it("keeps the page out of reach of a User with a Profile who has not completed the onboarding", async () => {
    await setup(notYetOnboarded);

    await expect.element(page.getByRole("dialog")).toBeVisible();
  });

  it("leaves the User on their page once onboarded", async () => {
    await setup(newcomer);
    await page.getByRole("textbox", { name: "First name" }).fill("Ada");
    await page.getByRole("textbox", { name: "Last name" }).fill("Lovelace");

    await page.getByRole("button", { name: "Get started" }).click();

    await expect.poll(() => page.getByRole("dialog").elements()).toEqual([]);
    await expect.element(page.getByRole("button", { name: "A page of the app" })).toBeVisible();
  });
});
