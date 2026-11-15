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
  await render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TodosList />
    </QueryClientProvider>,
  );
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
    await setup((request) => {
      if (request.method === "GET")
        return Response.json([todo("1", "Ship it"), todo("2", "Write it")]);
      const removal = Promise.withResolvers<Response>();
      removals.set(new URL(request.url).pathname, removal);
      return removal.promise;
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
  });

  it("keeps the todos already loaded when a refetch fails", async () => {
    await setup(() => Response.json([todo("1", "Ship it")]));
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();

    respond = () => new Response(null, { status: 500 });
    await page.getByRole("checkbox", { name: "Complete Ship it" }).click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not update this todo. Try again.");
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
    expect(page.getByText("Could not load your todos").elements()).toEqual([]);
  });

  it("offers to try again when the list cannot be loaded, and loads it on the retry", async () => {
    await setup(() => new Response(null, { status: 500 }));

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Check your connection and try again.");

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
      .toHaveTextContent("Could not update this todo. Try again.");
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
  });
});
