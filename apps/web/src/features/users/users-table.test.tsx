import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { usersPageSize } from "#/features/users/users-query.ts";
import { UsersSearch } from "#/features/users/users-search.ts";
import { UsersTable } from "#/features/users/users-table.tsx";

const user = (n: number, role: "user" | "admin" = "user") => ({
  id: `user-${n}`,
  email: `user-${n}@quack.dev`,
  role,
});

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);
vi.stubGlobal("fetch", fetch);

const total = usersPageSize + 1;
const pageOf = (request: Request) => Number(new URL(request.url).searchParams.get("page"));
const usersOn = (request: Request) =>
  Response.json({
    items:
      pageOf(request) === 1
        ? [user(1, "admin"), ...Array.from({ length: usersPageSize - 1 }, (_, i) => user(i + 2))]
        : [user(total)],
    total,
  });

const setup = async (response: typeof respond, url = "/users") => {
  respond = response;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/users",
    validateSearch: Schema.toStandardSchemaV1(UsersSearch),
    component: function Users() {
      const { page: current = 1 } = usersRoute.useSearch();
      return <UsersTable page={current} />;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([usersRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
};

const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

const previous = () => page.getByRole("link", { name: "Previous" });
const next = () => page.getByRole("link", { name: "Next" });

afterEach(() => {
  fetch.mockClear();
});

describe("UsersTable", () => {
  it("says it is loading while the users are on their way", async () => {
    const response = Promise.withResolvers<Response>();
    await setup(() => response.promise);

    await expect.poll(said).toContain("Loading users…");
    response.resolve(Response.json({ items: [], total: 0 }));
  });

  it("lists the email and the Role of each user of the page", async () => {
    await setup(usersOn);

    const admin = page.getByRole("row").filter({ hasText: "user-1@quack.dev" });
    await expect.element(admin.getByRole("cell", { name: "Admin" })).toBeVisible();
    const other = page.getByRole("row").filter({ hasText: "user-2@quack.dev" });
    await expect.element(other.getByRole("cell", { name: "User" })).toBeVisible();
    expect(page.getByRole("row").elements()).toHaveLength(usersPageSize + 1);
    await expect.element(page.getByText("Page 1 of 2")).toBeVisible();
  });

  it("asks the API for the page of the URL", async () => {
    await setup(usersOn, "/users?page=2");

    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    await expect.element(page.getByText("Page 2 of 2")).toBeVisible();
    const request = fetch.mock.calls[0]?.[0];
    expect(new URL(String(request)).searchParams.get("pageSize")).toBe(String(usersPageSize));
  });

  it("links to the next and the previous page through the URL", async () => {
    const { router } = await setup(usersOn);
    await expect.element(previous()).toHaveAttribute("aria-disabled", "true");

    await next().click();

    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    expect(router.state.location.search).toEqual({ page: 2 });
    await expect.element(next()).toHaveAttribute("aria-disabled", "true");

    await previous().click();

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    expect(router.state.location.search).toEqual({});
  });

  it("keeps the page shown while the next one is on its way", async () => {
    const second = Promise.withResolvers<Response>();
    await setup((request) => (pageOf(request) === 1 ? usersOn(request) : second.promise));
    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();

    await next().click();

    await expect.element(page.getByText("Page 2 of 2")).toBeVisible();
    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    expect(said()).toEqual([]);
    second.resolve(Response.json({ items: [user(total)], total }));
    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
  });

  it("shows the first page for a page that is not a page number", async () => {
    await setup(usersOn, "/users?page=abc");

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    await expect.element(page.getByText("Page 1 of 2")).toBeVisible();
  });

  it("leads back to the first page from a page past the last", async () => {
    await setup(
      (request) => (pageOf(request) === 1 ? usersOn(request) : Response.json({ items: [], total })),
      "/users?page=9",
    );

    await expect.element(page.getByText("No users on this page")).toBeVisible();
    await page.getByRole("link", { name: "Go to the first page" }).click();

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
  });

  it("offers to try again when the users cannot be loaded, and loads them on the retry", async () => {
    await setup(() => new Response(null, { status: 500 }));

    await expect
      .element(page.getByRole("alert").getByText("Could not load the users"))
      .toBeVisible();

    respond = usersOn;
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
  });
});
