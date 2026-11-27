import type { Todo } from "@quack/contracts/todos/todo";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { type ApiHandler, renderApp } from "#/testing/render-app.tsx";

const todo = (id: string, title: string, completed = false): typeof Todo.Encoded => ({
  id,
  ownerId: "user-1",
  title,
  completed,
  createdAt: "2026-01-01T00:00:00.000Z",
});

type Endpoint = "list" | "create" | "complete" | "remove";

const endpointOf = (request: Request): Endpoint => {
  const { pathname } = new URL(request.url);

  if (request.method === "GET") return "list";

  if (request.method === "DELETE") return "remove";

  return pathname.endsWith("/complete") ? "complete" : "create";
};

const idOf = (request: Request) =>
  new URL(request.url).pathname
    .replace(/\/complete$/, "")
    .split("/")
    .at(-1) ?? "";

/**
 * The Todos of the API, kept in memory. A test replaces how one endpoint answers in `overrides`, at any time, and
 * reaches the usual answer through `answer`.
 */
const todosApi = (...initial: ReadonlyArray<typeof Todo.Encoded>) => {
  let todos = [...initial];
  let lastId = todos.length;
  const requests: Array<{ readonly endpoint: Endpoint; readonly url: string; body: unknown }> = [];
  const overrides: Partial<Record<Endpoint, ApiHandler>> = {};

  const answer: Record<Endpoint, ApiHandler> = {
    list: () => Response.json(todos),
    create: async (request) => {
      const { title } = (await request.json()) as { title: string };
      lastId += 1;
      const created = todo(String(lastId), title);
      todos = [...todos, created];

      return Response.json(created);
    },
    complete: (request) => {
      const id = idOf(request);
      todos = todos.map((one) => (one.id === id ? { ...one, completed: true } : one));

      return Response.json(todos.find((one) => one.id === id));
    },
    remove: (request) => {
      const id = idOf(request);
      todos = todos.filter((one) => one.id !== id);

      return new Response(null, { status: 204 });
    },
  };

  const handler: ApiHandler = async (request) => {
    const endpoint = endpointOf(request);
    const body = endpoint === "create" ? await request.clone().json() : undefined;
    requests.push({ endpoint, url: request.url, body });

    return (overrides[endpoint] ?? answer[endpoint])(request);
  };

  /** Holds every request to `endpoint` until the returned function lets them through, answered as usual. */
  const hold = (endpoint: Endpoint) => {
    const release = Promise.withResolvers<void>();
    overrides[endpoint] = (request) => release.promise.then(() => answer[endpoint](request));

    return () => release.resolve();
  };

  const sent = (endpoint: Endpoint) => requests.filter((request) => request.endpoint === endpoint);

  return { handler, answer, overrides, hold, sent };
};

const failed: ApiHandler = () => new Response(null, { status: 500 });

const open = async (
  api: ReturnType<typeof todosApi>,
  viewport: "desktop" | "phone" = "desktop",
) => {
  await renderApp("/app", { api: api.handler, viewport });

  return {
    input: page.getByRole("textbox", { name: "New todo" }),
    add: page.getByRole("button", { name: "Add" }),
  };
};

const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

// The alerts of the list, not the live region of the toasts, also an alert, empty.
const todoAlerts = () => page.getByRole("list").getByRole("alert");

const addFailed = "Could not add the todo. Try again.";

/** The error of the form as shown, not as its status announces it. */
const shown = (text: string) =>
  page
    .getByText(text)
    .elements()
    .filter((element) => element.getAttribute("role") !== "status");

describe("the Todos page", () => {
  it("counts the todos left to do", async () => {
    await open(todosApi(todo("1", "Ship it"), todo("2", "Write it", true), todo("3", "Test it")));

    await expect.element(page.getByRole("heading", { name: "Todos", level: 1 })).toBeVisible();
    await expect.element(page.getByText("2 left")).toBeVisible();
  });

  it("says it is loading while the list is on its way", async () => {
    const api = todosApi();
    const release = api.hold("list");
    await open(api);

    await expect.poll(said).toContain("Loading todos…");
    release();
  });

  it("shows an empty state when there is no todo", async () => {
    await open(todosApi());

    await expect.element(page.getByText("No todos yet")).toBeVisible();
  });

  it("names each control after its todo", async () => {
    await open(todosApi(todo("1", "Ship it"), todo("2", "Write it", true)));

    await expect
      .element(page.getByRole("checkbox", { name: "Complete Ship it" }))
      .not.toBeChecked();
    await expect.element(page.getByRole("checkbox", { name: "Complete Write it" })).toBeChecked();
    await expect.element(page.getByRole("button", { name: "Remove Ship it" })).toBeVisible();
  });

  it("shows the way to remove a todo on a phone's layout, with no hover to reveal it", async () => {
    await open(todosApi(todo("1", "Ship it")), "phone");

    const remove = page.getByRole("button", { name: "Remove Ship it" });
    await expect.element(remove).toBeVisible();
    expect(getComputedStyle(remove.element()).opacity).toBe("1");
  });

  it("offers to try again when the list cannot be loaded, and loads it on the retry", async () => {
    const api = todosApi(todo("1", "Ship it"));
    api.overrides.list = failed;
    await open(api);

    await expect
      .element(page.getByRole("alert").getByText("Could not load your todos"))
      .toBeVisible();
    await expect.element(page.getByText("Check your connection and try again.")).toBeVisible();

    delete api.overrides.list;
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
  });
});

describe("adding a todo", () => {
  it("reports a blank title on the field, focuses it, and sends nothing", async () => {
    const api = todosApi();
    const { input, add } = await open(api);

    await add.click();

    await expect.element(input).toHaveFocus();
    await expect.element(input).toBeInvalid();
    await expect.element(input).toHaveAccessibleDescription("Title is required");
    expect(api.sent("create")).toEqual([]);

    await userEvent.keyboard("Ship it");
    await expect.element(input).toBeValid();
    await expect.element(input).toHaveAccessibleDescription("");
  });

  it("reports a title over 120 characters, counted after trimming", async () => {
    const api = todosApi();
    const { input } = await open(api);

    await input.fill("x".repeat(121));
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveAccessibleDescription("Title must be at most 120 characters");
    expect(api.sent("create")).toEqual([]);

    await input.fill(` ${"x".repeat(120)} `);
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("");
    expect(api.sent("create").map(({ body }) => body)).toEqual([{ title: "x".repeat(120) }]);
  });

  it("says the error when Enter is pressed in the field, which already has the focus", async () => {
    const { input } = await open(todosApi());

    await input.click();
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain("Title is required");
  });

  it("sends the trimmed title, clears the input, lists the todo, and announces it", async () => {
    const api = todosApi();
    const { input } = await open(api);

    await input.fill("  Ship it  ");
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("");
    expect(api.sent("create").map(({ body }) => body)).toEqual([{ title: "Ship it" }]);
    await expect.poll(said).toContain("Added Ship it");
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
    await expect.element(page.getByText("1 left")).toBeVisible();
  });

  it("calls the API on the page's own origin, under /api", async () => {
    const api = todosApi();
    const { input } = await open(api);

    await input.fill("Ship it");
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("");
    expect(api.sent("create").map(({ url }) => url)).toEqual([`${location.origin}/api/todos`]);
  });

  it("keeps the title when the request fails, and drops the error on the next edit", async () => {
    const api = todosApi();
    api.overrides.create = failed;
    const { input } = await open(api);

    await input.fill("Ship it");
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain(addFailed);
    expect(shown(addFailed)).toHaveLength(1);
    await expect.element(input).toHaveValue("Ship it");

    await userEvent.keyboard("!");
    await expect.poll(() => page.getByText(addFailed).elements()).toEqual([]);
  });

  it("adds the todo on a retry after a failure", async () => {
    const api = todosApi();
    api.overrides.create = failed;
    const { input } = await open(api);
    await input.fill("Ship it");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => shown(addFailed)).toHaveLength(1);

    delete api.overrides.create;
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("");
    expect(page.getByText(addFailed).elements()).toEqual([]);
  });

  it("submits once while a request is running, and keeps what was typed meanwhile", async () => {
    const api = todosApi();
    const release = api.hold("create");
    const { input, add } = await open(api);

    await input.fill("First");
    await userEvent.keyboard("{Enter}");
    await expect.element(add).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard(" and more{Enter}");
    // The button ignores Enter and clicks while submitting; a script or another control may still submit.
    (input.element() as HTMLInputElement).form?.requestSubmit();
    release();

    await expect.element(add).not.toHaveAttribute("aria-disabled");
    await expect.element(input).toHaveValue("First and more");
    expect(api.sent("create")).toHaveLength(1);
  });

  it("does not report a draft emptied during the request, and leaves the focus alone", async () => {
    const api = todosApi();
    const release = api.hold("create");
    const { input, add } = await open(api);

    await input.fill("First");
    await userEvent.keyboard("{Enter}");
    await input.clear();
    await userEvent.tab();
    release();

    await expect.element(add).not.toHaveAttribute("aria-disabled");
    expect(page.getByText("Title is required").elements()).toEqual([]);
    await expect.element(add).toHaveFocus();
  });
});

describe("completing and removing a todo", () => {
  it("shows a todo completed once the API has completed it", async () => {
    await open(todosApi(todo("1", "Ship it")));

    await page.getByRole("checkbox", { name: "Complete Ship it" }).click();

    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeChecked();
    await expect.element(page.getByText("0 left")).toBeVisible();
  });

  it("keeps a row disabled while its own request runs, whatever the other rows do", async () => {
    const api = todosApi(todo("1", "Ship it"), todo("2", "Write it"));
    const release = api.hold("remove");

    await open(api);
    const removeShip = page.getByRole("button", { name: "Remove Ship it" });
    const removeWrite = page.getByRole("button", { name: "Remove Write it" });
    const completeShip = page.getByRole("checkbox", { name: "Complete Ship it" });

    await removeShip.click();
    await expect.element(removeShip).toBeDisabled();
    await expect.element(completeShip).toBeDisabled();
    await expect.element(removeWrite).toBeEnabled();
    await removeWrite.click();

    await expect.element(removeShip).toBeDisabled();
    await expect.element(removeWrite).toBeDisabled();
    expect(api.sent("remove")).toHaveLength(2);

    release();
    await expect.element(page.getByText("No todos yet")).toBeVisible();
  });

  it("keeps a row disabled while its todo is being completed", async () => {
    const api = todosApi(todo("1", "Ship it"));
    const release = api.hold("complete");
    await open(api);
    const complete = page.getByRole("checkbox", { name: "Complete Ship it" });
    const remove = page.getByRole("button", { name: "Remove Ship it" });

    await complete.click();

    await expect.element(complete).toBeDisabled();
    await expect.element(remove).toBeDisabled();
    release();
    await expect.element(complete).toBeChecked();
    await expect.element(remove).toBeEnabled();
    expect(api.sent("remove")).toEqual([]);
  });

  it("says when a todo cannot be completed, and keeps it to do", async () => {
    const api = todosApi(todo("1", "Ship it"));
    api.overrides.complete = failed;
    await open(api);

    await page.getByRole("checkbox", { name: "Complete Ship it" }).click();

    await expect
      .element(todoAlerts())
      .toHaveTextContent("Could not complete this todo. Try again.");
    await expect
      .element(page.getByRole("checkbox", { name: "Complete Ship it" }))
      .not.toBeChecked();
  });

  it("says when a todo cannot be removed, and keeps it", async () => {
    const api = todosApi(todo("1", "Ship it"));
    api.overrides.remove = failed;
    await open(api);

    await page.getByRole("button", { name: "Remove Ship it" }).click();

    await expect.element(todoAlerts()).toHaveTextContent("Could not remove this todo. Try again.");
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
  });

  it("drops the failure of one request with the next, of the other kind", async () => {
    const api = todosApi(todo("1", "Ship it"));
    api.overrides.complete = failed;
    const release = api.hold("remove");
    await open(api);
    await page.getByRole("checkbox", { name: "Complete Ship it" }).click();
    await expect.element(todoAlerts()).toBeVisible();

    await page.getByRole("button", { name: "Remove Ship it" }).click();

    await expect.poll(() => todoAlerts().elements()).toEqual([]);
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
    release();
    await expect.element(page.getByText("No todos yet")).toBeVisible();
  });
});

describe("refreshing the list", () => {
  it("keeps the todos already loaded when a refetch fails, and says so", async () => {
    const api = todosApi(todo("1", "Ship it"));
    await open(api);
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();

    api.overrides.list = failed;
    api.overrides.complete = failed;
    await page.getByRole("checkbox", { name: "Complete Ship it" }).click();

    await expect.element(page.getByText("Could not complete this todo. Try again.")).toBeVisible();

    const refreshFailed = page
      .getByRole("alert")
      .filter({ hasText: "Could not refresh your todos." });

    await expect.element(refreshFailed).toBeVisible();
    expect(api.sent("list")).toHaveLength(2);
    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeVisible();
    expect(page.getByText("Could not load your todos").elements()).toEqual([]);

    delete api.overrides.list;
    delete api.overrides.complete;
    await api.answer.complete(new Request(`${location.origin}/api/todos/1/complete`));
    await refreshFailed.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByRole("checkbox", { name: "Complete Ship it" })).toBeChecked();
    expect(page.getByText("Could not refresh your todos.").elements()).toEqual([]);
  });

  it("says a failed refresh over an empty list too", async () => {
    const api = todosApi();
    const { input } = await open(api);
    await expect.element(page.getByText("No todos yet")).toBeVisible();

    api.overrides.list = failed;
    await input.fill("Ship it");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(page.getByRole("alert").filter({ hasText: "Could not refresh your todos." }))
      .toBeVisible();
  });
});
