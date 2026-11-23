import type { User } from "@quack/contracts/identity/user";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { TimeZoneForm } from "#/features/time-zone/time-zone-form.tsx";

const ada: typeof User.Encoded = {
  id: "user-1",
  email: "ada@quack.dev",
  role: "user",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: "2026-01-01T00:05:00.000Z",
  profile: null,
  timeZone: "Europe/Paris",
};

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

const echo = async (request: Request) => Response.json({ ...ada, ...(await request.json()) });

const setup = async (response: typeof respond) => {
  respond = response;
  const queryClient = new QueryClient();
  queryClient.setQueryData(currentUserQueryOptions.queryKey, ada);

  const rootRoute = createRootRoute({
    component: () => <TimeZoneForm currentUser={ada} />,
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return {
    queryClient,
    timeZone: page.getByRole("combobox", { name: "Time zone" }),
    save: page.getByRole("button", { name: "Save" }),
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

describe("TimeZoneForm", () => {
  it("starts from the time zone of the Current User, and says what it changes", async () => {
    const form = await setup(echo);

    await expect.element(form.timeZone).toHaveValue("Europe/Paris");
    await expect.element(form.timeZone).toHaveAccessibleDescription(/midnight/);
  });

  it("sends the chosen time zone, and makes it the Current User's", async () => {
    const requests: Array<{ method: string; url: string; body: unknown }> = [];

    const form = await setup(async (request) => {
      requests.push({
        method: request.method,
        url: request.url,
        body: await request.clone().json(),
      });

      return echo(request);
    });

    await form.timeZone.fill("new york");
    await page.getByRole("option", { name: "America/New York" }).click();
    await form.save.click();

    await expect.poll(said).toContain("Time zone saved");
    expect(requests).toEqual([
      {
        method: "PUT",
        url: `${location.origin}/api/me/time-zone`,
        body: { timeZone: "America/New_York" },
      },
    ]);
    expect(form.queryClient.getQueryData(currentUserQueryOptions.queryKey)).toEqual({
      ...ada,
      timeZone: "America/New_York",
    });
  });

  it("says that the time zone was not saved when the request fails, and keeps the Current User's", async () => {
    const form = await setup(() => new Response(null, { status: 500 }));

    await form.timeZone.fill("tokyo");
    await page.getByRole("option", { name: "Asia/Tokyo" }).click();
    await form.save.click();

    await expect.poll(said).toContain("Could not save the time zone. Try again.");
    expect(form.queryClient.getQueryData(currentUserQueryOptions.queryKey)).toEqual(ada);
  });
});
