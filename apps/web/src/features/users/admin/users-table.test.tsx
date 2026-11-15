import { defaultPageSize } from "@quack/contracts/pagination/paginated";
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
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { UsersSearch } from "#/features/users/admin/users-search.ts";
import { UsersTable } from "#/features/users/admin/users-table.tsx";

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

const total = defaultPageSize + 1;
const pageOf = (request: Request) => Number(new URL(request.url).searchParams.get("page"));
const firstPage = [
  user(1, "admin"),
  ...Array.from({ length: defaultPageSize - 1 }, (_, i) => user(i + 2)),
];
const usersOn = (request: Request) =>
  Response.json({ items: [firstPage, [user(total)]][pageOf(request) - 1] ?? [], total });
const ninePages = () => Response.json({ items: firstPage, total: defaultPageSize * 9 });

const scrollerOfTable = () => {
  const scroller = page.getByRole("table").element().closest("[data-slot=data-table-viewport]");
  if (!(scroller instanceof HTMLElement)) throw new Error("The table scrolls in no viewport.");
  return scroller;
};

const currentPages = () =>
  pagination()
    .getByRole("link")
    .elements()
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.getAttribute("aria-label"));

const setup = async (
  response: typeof respond,
  url = "/users",
  size: { width?: number; height?: number } = {},
) => {
  respond = response;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/users",
    validateSearch: Schema.toStandardSchemaV1(UsersSearch),
    component: function Users() {
      const { page: current = 1 } = usersRoute.useSearch();
      return (
        <div style={{ ...size, display: "flex", flexDirection: "column" }}>
          <UsersTable page={current} />
        </div>
      );
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

const pagination = () => page.getByRole("navigation", { name: "Pages of users" });
const previous = () => pagination().getByRole("link", { name: "Go to previous page" });
const next = () => pagination().getByRole("link", { name: "Go to next page" });

const defaultViewport = { width: 414, height: 896 };

afterEach(async () => {
  fetch.mockClear();
  await page.viewport(defaultViewport.width, defaultViewport.height);
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
    expect(page.getByRole("row").elements()).toHaveLength(defaultPageSize + 1);
    await expect.element(page.getByText("Page 1 of 2")).toBeVisible();
  });

  it("links to each page by its number, and marks the current one", async () => {
    const { router } = await setup(usersOn);
    await expect
      .element(pagination().getByRole("link", { name: "Page 1" }))
      .toHaveAttribute("aria-current", "page");

    await pagination().getByRole("link", { name: "Page 2" }).click();

    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    expect(router.state.location.search).toEqual({ page: 2 });
    expect(currentPages()).toEqual(["Page 2"]);
  });

  it("asks the API for the page of the URL", async () => {
    await setup(usersOn, "/users?page=2");

    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    await expect.element(page.getByText("Page 2 of 2")).toBeVisible();
    const request = fetch.mock.calls[0]?.[0];
    const { searchParams } = new URL(String(request));
    expect(searchParams.get("page")).toBe("2");
    expect(searchParams.get("pageSize")).toBe(String(defaultPageSize));
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
    const table = page.getByRole("table").element().closest("[aria-busy]");
    expect(table?.getAttribute("aria-busy")).toBe("true");
    second.resolve(Response.json({ items: [user(total)], total }));
    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    expect(table?.getAttribute("aria-busy")).toBe("false");
  });

  it("shows the first page for a page that is not a page number", async () => {
    await setup(usersOn, "/users?page=abc");

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    await expect.element(page.getByText("Page 1 of 2")).toBeVisible();
    expect(currentPages()).toEqual(["Page 1"]);
  });

  it("marks the first page current when the URL names it", async () => {
    await setup(usersOn, "/users?page=1");

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    expect(currentPages()).toEqual(["Page 1"]);
  });

  it("keeps the focus in the pagination when Next leads to the last page", async () => {
    await setup(usersOn);
    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();

    next().element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(next()).toHaveAttribute("aria-disabled", "true");
    await expect.element(pagination().getByRole("link", { name: "Page 2" })).toHaveFocus();
  });

  it("keeps the focus in the pagination when Previous leads to the first page", async () => {
    await setup(usersOn, "/users?page=2");
    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();

    previous().element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(previous()).toHaveAttribute("aria-disabled", "true");
    await expect.element(pagination().getByRole("link", { name: "Page 1" })).toHaveFocus();
  });

  it("leaves the focus on Previous when it stays enabled, from a page past the last", async () => {
    await setup(usersOn, "/users?page=9");
    await expect.element(page.getByText("No users on this page")).toBeVisible();

    previous().element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    await expect.element(previous()).toHaveFocus();
  });

  it("scrolls its rows under the header and above the footer when its height is bounded", async () => {
    const height = 400;
    await setup(usersOn, "/users", { height });
    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();

    const scroller = scrollerOfTable();
    scroller.scrollTop = scroller.scrollHeight;

    const bounds = scroller.getBoundingClientRect();
    const header = page.getByText("Email", { exact: true }).element().getBoundingClientRect();
    expect(header.top).toBeGreaterThanOrEqual(bounds.top);
    const footer = pagination().element().getBoundingClientRect();
    expect(footer.top).toBeGreaterThanOrEqual(bounds.bottom);
    expect(footer.bottom - bounds.top).toBeLessThanOrEqual(height);
  });

  it("stacks the footer when the table is narrow, whatever the width of the window", async () => {
    await page.viewport(1280, 800);
    await setup(ninePages, "/users?page=5", { width: 470 });
    await expect.element(next()).toBeVisible();

    const scroller = scrollerOfTable();
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
    const summary = page.getByText("Page 5 of 9").element().getBoundingClientRect();
    expect(summary.bottom).toBeLessThanOrEqual(pagination().element().getBoundingClientRect().top);
  });

  it("puts the footer on one row when the table is wide", async () => {
    await page.viewport(1280, 800);
    await setup(ninePages, "/users?page=5", { width: 900 });
    await expect.element(next()).toBeVisible();

    const summary = page.getByText("Page 5 of 9").element().getBoundingClientRect();
    const links = pagination().element().getBoundingClientRect();
    expect(summary.top).toBeGreaterThanOrEqual(links.top);
    expect(summary.bottom).toBeLessThanOrEqual(links.bottom);
  });

  it("fits the pagination in the width of a phone", async () => {
    await page.viewport(375, 667);
    await setup(ninePages, "/users?page=5");

    await expect.element(next()).toBeVisible();
    const scroller = scrollerOfTable();
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);
    expect(next().element().getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
  });

  it("leads back to the first page from a page past the last", async () => {
    await setup(
      (request) => (pageOf(request) === 1 ? usersOn(request) : Response.json({ items: [], total })),
      "/users?page=9",
    );

    await expect.element(page.getByText("No users on this page")).toBeVisible();
    await expect.element(previous()).toHaveAttribute("href", "/users?page=2");
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
