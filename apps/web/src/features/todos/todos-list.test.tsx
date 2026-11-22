import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { TodosList } from "#/features/todos/todos-list.tsx";

const todo = (id: string, title: string, completed = false) => ({
  id,
  ownerId: "user-1",
  title,
  completed,
  createdAt: "2026-01-01T00:00:00.000Z",
});

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);
vi.stubGlobal("fetch", fetch);

const setup = async (response: typeof respond) => {
  respond = response;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={queryClient}>
      <TodosList />
    </QueryClientProvider>,
  );
  return { queryClient };
};

const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

afterEach(() => {
  fetch.mockClear();
});

describe("TodosList", () => {
  it("says it is loading while the list is on its way", async () => {
    const response = Promise.withResolvers<Response>();
    await setup(() => response.promise);

    await expect.poll(said).toContain("Loading todos…");
    response.resolve(Response.json([]));
  });

  it("shows an empty state when there is no todo", async () => {
    await setup(() => Response.json([]));

    await expect.element(page.getByText("No todos yet")).toBeVisible();
  });

  it("names each control after its todo", async () => {
    await setup(() => Response.json([todo("1", "Ship it"), todo("2", "Write it", true)]));

    await expect
      .element(page.getByRole("checkbox", { name: "Complete Ship it" }))
      .not.toBeChecked();
    await expect.element(page.getByRole("checkbox", { name: "Complete Write it" })).toBeChecked();
    await expect.element(page.getByRole("button", { name: "Remove Ship it" })).toBeVisible();
  });

  it("shows the way to remove a todo on a phone's layout, with no hover to reveal it", async () => {
    await page.viewport(375, 800);
    await setup(() => Response.json([todo("1", "Ship it")]));

    const remove = page.getByRole("button", { name: "Remove Ship it" });
    await expect.element(remove).toBeVisible();
    expect(getComputedStyle(remove.element()).opacity).toBe("1");
  });

  it("shows a todo completed once the API has completed it", async () => {
    let completed = false;
    await setup((request) => {
      if (request.method === "POST") completed = true;
      return request.method === "GET"
        ? Response.json([todo("1", "Ship it", completed)])
        : Response.json(todo("1", "Ship it", true));
    });

    await page.getByRole("checkbox", { name: "Complete Ship it" }).click();

    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeChecked();
  });

  it("keeps a row disabled while its own request runs, whatever the other rows do", async () => {
    const removals = new Map<string, PromiseWithResolvers<Response>>();
    const removed = new Set<string>();
    await setup((request) => {
      if (request.method === "GET")
        return Response.json(
          [todo("1", "Ship it"), todo("2", "Write it")].filter(({ id }) => !removed.has(id)),
        );
      const id = new URL(request.url).pathname.split("/").at(-1) ?? "";
      const removal = Promise.withResolvers<Response>();
      removals.set(id, removal);
      return removal.promise.finally(() => removed.add(id));
    });
    const removeShip = page.getByRole("button", { name: "Remove Ship it" });
    const removeWrite = page.getByRole("button", { name: "Remove Write it" });

    await removeShip.click();
    await expect.element(removeShip).toBeDisabled();
    await expect.element(removeWrite).toBeEnabled();
    await removeWrite.click();

    await expect.element(removeShip).toBeDisabled();
    await expect.element(removeWrite).toBeDisabled();
    for (const removal of removals.values()) removal.resolve(new Response(null, { status: 204 }));
    await expect.element(page.getByText("No todos yet")).toBeVisible();
  });

  it("keeps the todos already loaded when a refetch fails, and says so", async () => {
    let loads = 0;
    await setup((request) => {
      if (request.method === "GET") loads += 1;
      return Response.json([todo("1", "Ship it")]);
    });
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();

    respond = (request) => {
      if (request.method === "GET") loads += 1;
      return new Response(null, { status: 500 });
    };
    await page.getByRole("checkbox", { name: "Complete Ship it" }).click();

    await expect.element(page.getByText("Could not complete this todo. Try again.")).toBeVisible();
    const refreshFailed = page
      .getByRole("alert")
      .filter({ hasText: "Could not refresh your todos." });
    await expect.element(refreshFailed).toBeVisible();
    expect(loads).toBe(2);
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
    expect(page.getByText("Could not load your todos").elements()).toEqual([]);

    respond = () => Response.json([todo("1", "Ship it", true)]);
    await refreshFailed.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeChecked();
    expect(page.getByText("Could not refresh your todos.").elements()).toEqual([]);
  });

  it("says a failed refresh over an empty list too", async () => {
    const { queryClient } = await setup(() => Response.json([]));
    await expect.element(page.getByText("No todos yet")).toBeVisible();

    respond = () => new Response(null, { status: 500 });
    await queryClient.invalidateQueries();

    await expect
      .element(page.getByRole("alert").filter({ hasText: "Could not refresh your todos." }))
      .toBeVisible();
  });

  it("offers to try again when the list cannot be loaded, and loads it on the retry", async () => {
    await setup(() => new Response(null, { status: 500 }));

    await expect
      .element(page.getByRole("alert").getByText("Could not load your todos"))
      .toBeVisible();
    await expect.element(page.getByText("Check your connection and try again.")).toBeVisible();

    respond = () => Response.json([todo("1", "Ship it")]);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
  });

  it("says when a todo cannot be removed, and keeps it", async () => {
    await setup((request) =>
      request.method === "GET"
        ? Response.json([todo("1", "Ship it")])
        : new Response(null, { status: 500 }),
    );

    await page.getByRole("button", { name: "Remove Ship it" }).click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not remove this todo. Try again.");
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
  });
});
