import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { TodosForm } from "#/features/todos/todos-form.tsx";

const created = (title: string) =>
  Response.json({
    id: "1",
    ownerId: "user-1",
    title,
    completed: false,
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
    <QueryClientProvider client={new QueryClient()}>
      <TodosForm />
    </QueryClientProvider>,
  );
  return {
    input: page.getByRole("textbox", { name: "New todo" }),
    add: page.getByRole("button", { name: "Add" }),
  };
};

const failure = "Could not add the todo. Try again.";

const shown = (text: string) =>
  page
    .getByText(text)
    .elements()
    .filter((element) => element.getAttribute("role") !== "status");

const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

afterEach(() => {
  fetch.mockClear();
});

describe("TodosForm", () => {
  it("reports a blank title on the field, focuses it, and sends nothing", async () => {
    const { input, add } = await setup(() => created(""));

    await add.click();

    await expect.element(input).toHaveFocus();
    await expect.element(input).toBeInvalid();
    await expect.element(input).toHaveAccessibleDescription("Title is required");
    expect(fetch).not.toHaveBeenCalled();

    await userEvent.keyboard("Ship it");
    await expect.element(input).toBeValid();
    await expect.element(input).toHaveAccessibleDescription("");
  });

  it("says the error when Enter is pressed in the field, which already has the focus", async () => {
    const { input } = await setup(() => created(""));

    await input.click();
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain("Title is required");
  });

  it("sends the trimmed title, clears the input, and announces the todo", async () => {
    const requests: Array<unknown> = [];
    const { input } = await setup(async (request) => {
      requests.push(await request.json());
      return created("Ship it");
    });

    await input.fill("  Ship it  ");
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("");
    expect(requests).toEqual([{ title: "Ship it" }]);
    await expect.poll(said).toContain("Added Ship it");
  });

  it("calls the API on the page's own origin, under /api", async () => {
    const urls: Array<string> = [];
    const { input } = await setup((request) => {
      urls.push(request.url);
      return created("Ship it");
    });

    await input.fill("Ship it");
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("");
    expect(urls).toEqual([`${location.origin}/api/todos`]);
  });

  it("keeps the title when the request fails, and drops the error on the next edit", async () => {
    const { input } = await setup(() => new Response(null, { status: 500 }));

    await input.fill("Ship it");
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain(failure);
    expect(shown(failure)).toHaveLength(1);
    await expect.element(input).toHaveValue("Ship it");

    await userEvent.keyboard("!");
    await expect.poll(() => page.getByText(failure).elements()).toEqual([]);
  });

  it("adds the todo on a retry after a failure", async () => {
    const { input } = await setup(() => new Response(null, { status: 500 }));
    await input.fill("Ship it");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => shown(failure)).toHaveLength(1);

    respond = () => created("Ship it");
    await userEvent.keyboard("{Enter}");

    await expect.element(input).toHaveValue("");
    expect(page.getByText(failure).elements()).toEqual([]);
  });

  it("submits once while a request is running, and keeps what was typed meanwhile", async () => {
    const response = Promise.withResolvers<Response>();
    const { input, add } = await setup(() => response.promise);

    await input.fill("First");
    await userEvent.keyboard("{Enter}");
    await expect.element(add).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard(" and more{Enter}");
    // The button ignores Enter and clicks while submitting; a script or another control may still submit.
    (input.element() as HTMLInputElement).form?.requestSubmit();
    response.resolve(created("First"));

    await expect.element(add).not.toHaveAttribute("aria-disabled");
    await expect.element(input).toHaveValue("First and more");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not report a draft emptied during the request, and leaves the focus alone", async () => {
    const response = Promise.withResolvers<Response>();
    const { input, add } = await setup(() => response.promise);

    await input.fill("First");
    await userEvent.keyboard("{Enter}");
    await input.clear();
    await userEvent.tab();
    response.resolve(created("First"));

    await expect.element(add).not.toHaveAttribute("aria-disabled");
    expect(page.getByText("Title is required").elements()).toEqual([]);
    await expect.element(add).toHaveFocus();
  });
});
