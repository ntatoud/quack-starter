import type { Role } from "@quack/contracts/identity/user";
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

import { TooltipProvider } from "@quack/ui/components/tooltip";

import { UsersList } from "#/features/users/admin/users-list.tsx";
import { UsersSearch } from "#/features/users/admin/users-search.ts";

const user = (n: number, role: Role = "user") => ({
  id: `user-${n}`,
  email: `user-${n}@quack.dev`,
  role,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  emailVerifiedAt: null,
  profile: null,
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

// The rows scroll sideways when the table is narrow; the footer must fit.
const footerOfTable = () => {
  const footer = pagination().element().closest("[data-slot=data-table-footer]");
  if (!(footer instanceof HTMLElement)) throw new Error("The pagination is in no footer.");
  return footer;
};

const lastQuery = () => new URL(String(fetch.mock.lastCall?.[0])).searchParams;

const ada = {
  ...user(1),
  email: "ada@quack.dev",
  status: "suspended",
  emailVerifiedAt: "2026-01-02T00:00:00.000Z",
  profile: {
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    jobTitle: "Analyst",
    team: "engineering",
    country: "GB",
    tags: ["beta", "vip", "mentor", "remote"],
  },
};

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
      return (
        <TooltipProvider>
          <div style={{ ...size, display: "flex", flexDirection: "column" }}>
            <UsersList urlSearch={usersRoute.useSearch()} />
          </div>
        </TooltipProvider>
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

const sortOf = (column: string) =>
  page
    .getByRole("button", { name: column, exact: true })
    .element()
    .closest("th")
    ?.getAttribute("aria-sort");
const queryOf = (call = 0) => new URL(String(fetch.mock.calls[call]?.[0])).searchParams;

const defaultViewport = { width: 414, height: 896 };

afterEach(async () => {
  fetch.mockClear();
  await page.viewport(defaultViewport.width, defaultViewport.height);
});

describe("UsersList", () => {
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

  it("keeps the rest of the search when it changes page", async () => {
    const { router } = await setup(usersOn, "/users?page=2&q=duck");
    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();

    await pagination().getByRole("link", { name: "Page 1" }).click();

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    expect(router.state.location.search).toEqual({ q: "duck" });
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

    const footer = footerOfTable();
    expect(footer.scrollWidth).toBe(footer.clientWidth);
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
    const footer = footerOfTable();
    expect(footer.scrollWidth).toBe(footer.clientWidth);
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

  it("asks the API once the typing pauses, from the first page, and keeps the search in the URL", async () => {
    const { router } = await setup(usersOn, "/users?page=2");
    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    fetch.mockClear();
    respond = () => Response.json({ items: [user(7)], total: 1 });

    await userEvent.type(
      page.getByRole("searchbox", { name: "Search users by name or email" }),
      "User-7",
    );

    await expect.element(page.getByText("user-7@quack.dev")).toBeVisible();
    await expect.element(page.getByText("Page 1 of 1")).toBeVisible();
    expect(fetch).toHaveBeenCalledOnce();
    const { searchParams } = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(searchParams.get("search")).toBe("User-7");
    expect(searchParams.get("page")).toBe("1");
    expect(router.state.location.search).toEqual({ q: "User-7" });
  });

  it("waits for the typing to pause before it asks the API", async () => {
    await setup(usersOn);
    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    fetch.mockClear();

    await userEvent.type(page.getByRole("searchbox"), "ad");

    expect(fetch).not.toHaveBeenCalled();
    await expect.poll(() => fetch.mock.calls.length, { timeout: 1000 }).toBe(1);
  });

  it("drops the search from the URL once the field is cleared", async () => {
    const { router } = await setup(usersOn, "/users?q=duck");
    await expect.element(page.getByRole("searchbox")).toHaveValue("duck");

    await userEvent.clear(page.getByRole("searchbox"));

    await expect.poll(() => router.state.location.search).toEqual({});
  });

  it("says no user matches a search that finds none", async () => {
    await setup(() => Response.json({ items: [], total: 0 }), "/users?q=duck");

    await expect.element(page.getByText("No users match “duck”")).toBeVisible();
    expect(page.getByRole("link", { name: "Go to the first page" }).elements()).toHaveLength(0);
  });

  it("keeps the search when it leads back to the first page", async () => {
    await setup(
      (request) => (pageOf(request) === 1 ? usersOn(request) : Response.json({ items: [], total })),
      "/users?page=9&q=user",
    );

    await expect
      .element(page.getByRole("link", { name: "Go to the first page" }))
      .toHaveAttribute("href", "/users?q=user");
  });

  it("sorts by a column from its header, from the first page, and keeps the order in the URL", async () => {
    const { router } = await setup(usersOn, "/users?page=2");
    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    await expect.poll(() => sortOf("Email")).toBe("ascending");
    fetch.mockClear();

    await page.getByRole("button", { name: "Role", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Descending" }).click();

    await expect.poll(() => router.state.location.search).toEqual({ orderBy: "role", dir: "desc" });
    await expect.poll(() => sortOf("Role")).toBe("descending");
    expect(sortOf("Email")).toBeNull();
    expect(queryOf().get("orderBy")).toBe("role");
    expect(queryOf().get("dir")).toBe("desc");
    expect(queryOf().get("page")).toBe("1");
  });

  it("marks the order of its column in the menu of its header", async () => {
    await setup(usersOn, "/users?orderBy=role&dir=desc");

    await page.getByRole("button", { name: "Role", exact: true }).click();

    await expect
      .element(page.getByRole("menuitemradio", { name: "Descending" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(page.getByRole("menuitemradio", { name: "Ascending" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("leaves the default order out of the URL", async () => {
    const { router } = await setup(usersOn, "/users?orderBy=role&dir=desc&q=user");
    await expect.poll(() => sortOf("Role")).toBe("descending");

    await page.getByRole("button", { name: "Email", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Ascending" }).click();

    await expect.poll(() => router.state.location.search).toEqual({ q: "user" });
    await expect.poll(() => sortOf("Email")).toBe("ascending");
  });

  it("asks the API for the default order and every Role when the URL names neither", async () => {
    await setup(usersOn, "/users?orderBy=id&dir=up&role=owner");

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    expect(queryOf().get("orderBy")).toBe("email");
    expect(queryOf().get("dir")).toBe("asc");
    expect(queryOf().has("role")).toBe(false);
  });

  it("adds a filter on the Role from its header, and keeps the Role chosen in the URL", async () => {
    const { router } = await setup(usersOn, "/users?page=2");
    await expect.element(page.getByText(`user-${total}@quack.dev`)).toBeVisible();
    fetch.mockClear();
    respond = () => Response.json({ items: [user(1, "admin")], total: 1 });

    await page.getByRole("button", { name: "Role", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();
    await page.getByRole("menuitemradio", { name: "Admin" }).click();

    await expect.poll(() => router.state.location.search).toEqual({ role: "admin" });
    await expect.element(page.getByRole("button", { name: "Role: Admin" })).toBeVisible();
    await expect.element(page.getByText("Page 1 of 1")).toBeVisible();
    expect(queryOf().get("role")).toBe("admin");
    expect(queryOf().get("page")).toBe("1");
  });

  it("keeps the Role filter it adds until it is removed, even without a Role", async () => {
    await setup(usersOn);
    await page.getByRole("button", { name: "Role", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();
    await expect.element(page.getByRole("menuitemradio", { name: "Admin" })).toBeVisible();

    await userEvent.keyboard("{Escape}");

    await expect.element(page.getByRole("button", { name: "Role: Select" })).toHaveFocus();
  });

  it("removes the Role filter, and hands the focus to the search", async () => {
    const { router } = await setup(usersOn, "/users?role=admin&q=user");

    await page.getByRole("button", { name: "Remove the Role filter" }).click();

    await expect.poll(() => router.state.location.search).toEqual({ q: "user" });
    expect(page.getByRole("button", { name: "Role: Admin" }).elements()).toHaveLength(0);
    await expect.element(page.getByRole("searchbox")).toHaveFocus();
  });

  it("filters by email from its header in the search", async () => {
    await setup(usersOn);

    await page.getByRole("button", { name: "Email", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();

    await expect
      .element(page.getByRole("searchbox", { name: "Search users by name or email" }))
      .toHaveFocus();
  });

  it("says no user has the Role of a filter that finds none", async () => {
    await setup(() => Response.json({ items: [], total: 0 }), "/users?role=admin");

    await expect.element(page.getByText("No users have the Role Admin")).toBeVisible();
  });

  it("hides a Role filter that loses its value when going back", async () => {
    const { router } = await setup(usersOn);
    await page.getByRole("button", { name: "Role", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();
    await page.getByRole("menuitemradio", { name: "Admin" }).click();
    await expect.element(page.getByRole("button", { name: "Role: Admin" })).toBeVisible();

    router.history.back();

    await expect.poll(() => router.state.location.search).toEqual({});
    await expect
      .poll(() => page.getByRole("group", { name: "Role filter" }).elements())
      .toHaveLength(0);
  });

  it("selects the search from the Email column, so typing replaces it", async () => {
    await setup(usersOn, "/users?q=duck");

    await page.getByRole("button", { name: "Email", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();

    const searchbox = page.getByRole("searchbox");
    await expect.element(searchbox).toHaveFocus();
    const input = searchbox.element() as HTMLInputElement;
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, "duck".length]);
  });

  it("adds a filter from the button next to the search", async () => {
    const { router } = await setup(usersOn);

    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("menuitem", { name: "Role" }).click();
    await page.getByRole("menuitemradio", { name: "Admin" }).click();

    await expect.poll(() => router.state.location.search).toEqual({ role: "admin" });
    await expect.element(page.getByRole("button", { name: "Role: Admin" })).toBeVisible();
    expect(lastQuery().get("role")).toBe("admin");
  });

  it("hides the button once every filter is shown", async () => {
    await setup(usersOn, "/users?status=active&role=user&team=design");

    await expect.element(page.getByRole("button", { name: "Team: Design" })).toBeVisible();
    expect(page.getByRole("button", { name: "Add filter" }).elements()).toHaveLength(0);
  });

  it("shows the Profile, the Status, and the dates of a User, and Never for one who never signed in", async () => {
    await setup(() => Response.json({ items: [ada, user(2)], total: 2 }));

    const row = page.getByRole("row").filter({ hasText: "ada@quack.dev" });
    await expect.element(row.getByRole("cell", { name: "Ada Lovelace" })).toBeVisible();
    await expect.element(row.getByRole("cell", { name: "Suspended" })).toBeVisible();
    await expect.element(row.getByRole("cell", { name: "Engineering" })).toBeVisible();
    await expect.element(row.getByRole("cell", { name: "Analyst" })).toBeVisible();
    await expect.element(row.getByRole("cell", { name: "United Kingdom" })).toBeVisible();
    await expect.element(row.getByRole("cell", { name: "Never" })).toBeVisible();
    await expect.element(row.getByRole("img", { name: "Verified" })).toBeVisible();
    await expect.element(row.getByRole("cell", { name: "Jan 1, 2026" })).toBeVisible();
    await expect.element(row.getByText("+2: mentor, remote")).toBeInTheDocument();
    const other = page.getByRole("row").filter({ hasText: "user-2@quack.dev" });
    await expect.element(other.getByRole("cell", { name: "No profile" })).toBeVisible();
    await expect.element(other.getByText("Not verified")).toBeInTheDocument();
  });

  it("sorts by the last sign-in from its header", async () => {
    const { router } = await setup(usersOn);
    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();

    await page.getByRole("button", { name: "Last sign-in", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Descending" }).click();

    await expect
      .poll(() => router.state.location.search)
      .toEqual({ orderBy: "lastSignInAt", dir: "desc" });
    await expect.poll(() => sortOf("Last sign-in")).toBe("descending");
    expect(lastQuery().get("orderBy")).toBe("lastSignInAt");
  });

  it("offers no filter from the header of a column that has none", async () => {
    await setup(usersOn);

    await page.getByRole("button", { name: "Country", exact: true }).click();

    await expect.element(page.getByRole("menuitemradio", { name: "Ascending" })).toBeVisible();
    expect(page.getByRole("menuitem", { name: "Filter" }).elements()).toHaveLength(0);
  });

  it("filters by the status and the team from their header, and keeps both in the URL", async () => {
    const { router } = await setup(usersOn);
    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();

    await page.getByRole("button", { name: "Status", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();
    await page.getByRole("menuitemradio", { name: "Suspended" }).click();
    await page.getByRole("button", { name: "Team", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();
    await page.getByRole("menuitemradio", { name: "Design" }).click();

    await expect
      .poll(() => router.state.location.search)
      .toEqual({ status: "suspended", team: "design" });
    await expect.element(page.getByRole("button", { name: "Status: Suspended" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Team: Design" })).toBeVisible();
    expect(lastQuery().get("status")).toBe("suspended");
    expect(lastQuery().get("team")).toBe("design");
  });

  it("filters by name from its header in the search", async () => {
    await setup(usersOn);

    await page.getByRole("button", { name: "Name", exact: true }).click();
    await page.getByRole("menuitem", { name: "Filter" }).click();

    await expect
      .element(page.getByRole("searchbox", { name: "Search users by name or email" }))
      .toHaveFocus();
  });

  it("says no user matches the filters when none does", async () => {
    await setup(() => Response.json({ items: [], total: 0 }), "/users?status=invited&team=sales");

    await expect.element(page.getByText("No users match these filters")).toBeVisible();
  });

  it("asks the API for every status and team when the URL names neither", async () => {
    await setup(usersOn, "/users?status=deleted&team=Sales");

    await expect.element(page.getByText("user-1@quack.dev")).toBeVisible();
    expect(queryOf().has("status")).toBe(false);
    expect(queryOf().has("team")).toBe(false);
  });
});
