import { brand } from "@quack/brand/brand";
import type { User } from "@quack/contracts/identity/user";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { OnboardingDialog } from "#/features/onboarding/onboarding-dialog.tsx";

const onboardedUser = {
  id: "1",
  email: "ada@example.com",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: "2026-01-01T00:00:00.000Z",
  profile: {
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    jobTitle: "",
    team: null,
    country: null,
  },
};

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);
vi.stubGlobal("fetch", fetch);

const setup = async (response: typeof respond) => {
  respond = response;
  const onboarded: Array<User> = [];
  const rootRoute = createRootRoute();
  const app = createRoute({
    getParentRoute: () => rootRoute,
    path: "app",
    component: () => (
      <OnboardingDialog email="ada@example.com" onOnboarded={(user) => void onboarded.push(user)} />
    ),
  });
  const signIn = createRoute({
    getParentRoute: () => rootRoute,
    path: "sign-in",
    component: () => <h1>Sign in</h1>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([app, signIn]),
    history: createMemoryHistory({ initialEntries: ["/app"] }),
  });
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return {
    onboarded,
    router,
    firstName: page.getByRole("textbox", { name: "First name" }),
    lastName: page.getByRole("textbox", { name: "Last name" }),
    getStarted: page.getByRole("button", { name: "Get started" }),
  };
};

const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

afterEach(() => {
  fetch.mockClear();
});

describe("OnboardingDialog", () => {
  it("opens on the first name, in a dialog named by its title", async () => {
    const dialog = await setup(() => Response.json(onboardedUser));

    await expect
      .element(page.getByRole("dialog", { name: `Welcome to ${brand.name}` }))
      .toBeVisible();
    await expect.element(dialog.firstName).toHaveFocus();
  });

  it("has Get started as its main action and Sign out as a secondary one", async () => {
    const dialog = await setup(() => Response.json(onboardedUser));
    const footer = page.getByRole("dialog").element().querySelector("[data-slot=dialog-footer]");

    expect(
      Array.from(footer?.querySelectorAll("button") ?? [], (button) => button.textContent),
    ).toEqual(["Sign out", "Get started"]);
    await expect.element(dialog.getStarted).toHaveAttribute("type", "submit");
    await expect.element(page.getByText("Signed in as ada@example.com")).toBeVisible();
  });

  it("signs out to the sign-in page", async () => {
    const requests: Array<string> = [];
    const dialog = await setup((request) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return new Response(null, { status: 204 });
    });

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect.poll(() => dialog.router.state.location.pathname).toBe("/sign-in");
    expect(requests).toEqual(["POST /api/sign-out"]);
  });

  it("stays open on Escape", async () => {
    await setup(() => Response.json(onboardedUser));

    await userEvent.keyboard("{Escape}");

    await expect.element(page.getByRole("dialog")).toBeVisible();
  });

  it("reports a missing name on its field, and sends nothing", async () => {
    const dialog = await setup(() => Response.json(onboardedUser));

    await dialog.firstName.fill("Ada");
    await dialog.getStarted.click();

    await expect.element(dialog.lastName).toHaveFocus();
    await expect.element(dialog.lastName).toHaveAccessibleDescription("Name is required");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("saves the name as the contract spells it, then hands over the User", async () => {
    const requests: Array<{ method: string; url: string; body: unknown }> = [];
    const dialog = await setup(async (request) => {
      requests.push({ method: request.method, url: request.url, body: await request.json() });
      return Response.json(onboardedUser);
    });

    await dialog.firstName.fill(" Ada ");
    await dialog.lastName.fill("Lovelace");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => dialog.onboarded).toHaveLength(1);
    expect(dialog.onboarded[0]?.profile).toMatchObject({ firstName: "Ada", lastName: "Lovelace" });
    expect(requests).toEqual([
      {
        method: "POST",
        url: `${location.origin}/api/me/onboarding`,
        body: { firstName: "Ada", lastName: "Lovelace" },
      },
    ]);
  });

  it("says that the name could not be saved, and keeps it", async () => {
    const dialog = await setup(() => new Response(null, { status: 500 }));

    await dialog.firstName.fill("Ada");
    await dialog.lastName.fill("Lovelace");
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain("Could not save your name. Try again.");
    await expect.element(dialog.firstName).toHaveValue("Ada");
    expect(dialog.onboarded).toEqual([]);
  });
});
