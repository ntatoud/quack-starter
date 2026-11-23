import { UserId } from "@quack/contracts/identity/user";
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

import { UserDetails } from "#/features/users/admin/user-details.tsx";

const ada = {
  id: "user-ada",
  email: "ada@quack.dev",
  role: "admin",
  status: "suspended",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: null,
  onboardedAt: "2026-01-02T00:00:00.000Z",
  timeZone: "Europe/Paris",
  profile: {
    firstName: "Ada",
    lastName: "Lovelace",
    avatarUrl: null,
    jobTitle: "Analyst",
    team: "engineering",
    country: "GB",
  },
};

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;

const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);

vi.stubGlobal("fetch", fetch);

const setup = async (id: string, response: typeof respond, canChange = true) => {
  respond = response;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <UserDetails id={UserId.make(id)} canChange={canChange} />,
    }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { router };
};

const detailOf = (term: string) =>
  page.getByRole("term").filter({ hasText: term }).element().nextElementSibling?.textContent;

const terms = () =>
  page
    .getByRole("term")
    .elements()
    .map((term) => term.textContent);

afterEach(() => {
  fetch.mockClear();
});

describe("UserDetails", () => {
  it("asks the API for the User of the id", async () => {
    await setup("user-ada", () => Response.json(ada));

    await expect.element(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe("/api/users/user-ada");
  });

  it("shows who the User is once, then their Profile and their activity", async () => {
    await setup("user-ada", () => Response.json(ada));

    await expect.element(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    expect(page.getByText("ada@quack.dev").elements()).toHaveLength(1);
    expect(page.getByText("Suspended", { exact: true }).elements()).toHaveLength(1);
    expect(page.getByText("Admin", { exact: true }).elements()).toHaveLength(1);
    expect(terms()).toEqual([
      "Team",
      "Job title",
      "Country",
      "Created",
      "Onboarded",
      "Last sign-in",
    ]);
    expect(detailOf("Job title")).toBe("Analyst");
    expect(detailOf("Team")).toBe("Engineering");
    expect(detailOf("Country")).toContain("United Kingdom");
    expect(detailOf("Created")).toBe("Jan 1, 2026");
    expect(detailOf("Onboarded")).toBe("Jan 2, 2026");
    expect(detailOf("Last sign-in")).toBe("Never");
  });

  it("says a User who has not onboarded has no Profile yet", async () => {
    await setup("user-ada", () => Response.json({ ...ada, profile: null, onboardedAt: null }));

    await expect.element(page.getByText(/No profile yet/)).toBeVisible();
    expect(detailOf("Onboarded")).toBe("Not yet");
    await expect.element(page.getByRole("heading", { name: "ada@quack.dev" })).toBeVisible();
    expect(page.getByRole("term").filter({ hasText: "Team" }).elements()).toHaveLength(0);
  });

  it("says no User has an id the API does not know, and links to the list", async () => {
    await setup("nobody", () =>
      Response.json({ _tag: "UserNotFound", id: "nobody" }, { status: 404 }),
    );

    await expect.element(page.getByRole("alert").getByText("No such user")).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "See every user" }))
      .toHaveAttribute("href", "/admin/users");
  });

  it("offers to try again when the User cannot be loaded, and loads them on the retry", async () => {
    await setup("user-ada", () => new Response(null, { status: 500 }));
    await expect
      .element(page.getByRole("alert").getByText("Could not load the user"))
      .toBeVisible();

    respond = () => Response.json(ada);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
  });

  it("suspends an active User, and shows them suspended", async () => {
    const requests: Array<string> = [];
    await setup("user-ada", (request) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      const status = requests.includes("PATCH /api/users/user-ada") ? "suspended" : "active";

      return Response.json({ ...ada, status });
    });

    await page.getByRole("button", { name: "Suspend" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Suspend Ada Lovelace?" });
    await expect.element(dialog).toBeVisible();
    expect(requests).not.toContain("PATCH /api/users/user-ada");
    await dialog.getByRole("button", { name: "Suspend user" }).click();

    await expect.element(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
    expect(page.getByRole("alertdialog").elements()).toHaveLength(0);
    expect(requests).toContain("PATCH /api/users/user-ada");
    expect(page.getByText("Suspended", { exact: true }).elements()).toHaveLength(1);
  });

  it("makes an admin a user", async () => {
    const bodies: Array<unknown> = [];
    await setup("user-ada", async (request) => {
      if (request.method === "PATCH") bodies.push(await request.json());

      return Response.json({ ...ada, role: bodies.length > 0 ? "user" : "admin" });
    });

    await page.getByRole("button", { name: "Remove admin" }).click();

    await expect.element(page.getByRole("button", { name: "Make admin" })).toBeVisible();
    expect(bodies).toEqual([{ role: "user" }]);
  });

  it("offers neither to suspend nor to reactivate an invited User", async () => {
    await setup("user-ada", () => Response.json({ ...ada, status: "invited" }));

    await expect.element(page.getByRole("button", { name: "Remove admin" })).toBeVisible();
    expect(page.getByRole("button", { name: /Suspend|Reactivate/ }).elements()).toHaveLength(0);
  });

  it("offers no change to the Admin looking at their own page", async () => {
    await setup("user-ada", () => Response.json(ada), false);

    await expect.element(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    expect(page.getByRole("button").elements()).toHaveLength(0);
  });

  it("says so when a change fails", async () => {
    await setup("user-ada", (request) =>
      request.method === "GET" ? Response.json(ada) : new Response(null, { status: 500 }),
    );

    await page.getByRole("button", { name: "Reactivate" }).click();

    await expect
      .element(page.getByRole("alert").getByText("Could not change the user. Try again."))
      .toBeVisible();
  });

  it("suspends nobody when the confirmation is cancelled", async () => {
    await setup("user-ada", () => Response.json({ ...ada, status: "active" }));

    await page.getByRole("button", { name: "Suspend" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect.element(page.getByRole("button", { name: "Suspend" })).toHaveFocus();
    expect(fetch.mock.calls.map(([input, init]) => new Request(input, init).method)).toEqual([
      "GET",
    ]);
  });

  it("makes a user an admin once confirmed", async () => {
    const bodies: Array<unknown> = [];
    await setup("user-ada", async (request) => {
      if (request.method === "PATCH") bodies.push(await request.json());

      return Response.json({ ...ada, role: bodies.length > 0 ? "admin" : "user" });
    });

    await page.getByRole("button", { name: "Make admin" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Make Ada Lovelace an admin?" });
    await dialog.getByRole("button", { name: "Make admin" }).click();

    await expect.element(page.getByRole("button", { name: "Remove admin" })).toBeVisible();
    expect(bodies).toEqual([{ role: "admin" }]);
  });

  it("keeps the confirmation open and says so when the suspension fails", async () => {
    await setup("user-ada", (request) =>
      request.method === "GET"
        ? Response.json({ ...ada, status: "active" })
        : new Response(null, { status: 500 }),
    );

    await page.getByRole("button", { name: "Suspend" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Suspend user" }).click();

    await expect
      .element(dialog.getByRole("alert").getByText(/Could not change the user/))
      .toBeVisible();
  });

  it("stops saying a change failed once another one succeeds", async () => {
    let fails = true;
    await setup("user-ada", async (request) => {
      if (request.method === "GET") return Response.json(ada);

      if (fails) return new Response(null, { status: 500 });

      return Response.json({ ...ada, ...(await request.json()) });
    });
    await page.getByRole("button", { name: "Remove admin" }).click();
    await expect.element(page.getByText("Could not change the user. Try again.")).toBeVisible();

    fails = false;
    await page.getByRole("button", { name: "Reactivate" }).click();

    await expect
      .poll(() => page.getByText("Could not change the user. Try again.").elements())
      .toHaveLength(0);
  });

  it("deletes a User once confirmed, and leads back to the Users table", async () => {
    const requests: Array<string> = [];

    const { router } = await setup("user-ada", (request) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);

      return request.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json(ada);
    });

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete Ada Lovelace?" });
    await expect.element(dialog.getByText(/cannot be undone/)).toBeVisible();
    expect(requests).not.toContain("DELETE /api/users/user-ada");
    await dialog.getByRole("button", { name: "Delete user" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/admin/users");
    expect(requests).toContain("DELETE /api/users/user-ada");
  });

  it("keeps the User page and says so when the deletion fails", async () => {
    await setup("user-ada", (request) =>
      request.method === "DELETE" ? new Response(null, { status: 500 }) : Response.json(ada),
    );

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete Ada Lovelace?" });
    await dialog.getByRole("button", { name: "Delete user" }).click();

    await expect
      .element(dialog.getByRole("alert").getByText("Could not delete the user. Try again."))
      .toBeVisible();
    // Behind the dialog, so out of the accessibility tree: found by its text.
    expect(page.getByText("Ada Lovelace", { exact: true }).elements()).not.toHaveLength(0);
  });

  it("leads to the Users table when another Admin deleted the User first", async () => {
    const { router } = await setup("user-ada", (request) =>
      request.method === "DELETE"
        ? Response.json({ _tag: "UserNotFound", id: "user-ada" }, { status: 404 })
        : Response.json(ada),
    );

    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete user" }).click();

    await expect.poll(() => router.state.location.pathname).toBe("/admin/users");
  });
});
