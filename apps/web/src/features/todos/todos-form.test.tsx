// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { TodosForm } from "#/features/todos/todos-form.tsx";

const created = (title: string) =>
  Response.json({ id: "1", title, completed: false, createdAt: "2026-01-01T00:00:00.000Z" });

// The API client keeps the `fetch` it first saw, so one stub serves every test and each test sets its response.
let respond: (request: Request) => Response | Promise<Response>;
const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
  respond(new Request(input, init)),
);
vi.stubGlobal("fetch", fetch);

/** Renders the form against a stubbed network, the one edge the form does not own. */
const setup = (response: typeof respond) => {
  respond = response;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TodosForm />
    </QueryClientProvider>,
  );
  return {
    user: userEvent.setup(),
    input: screen.getByLabelText<HTMLInputElement>("New todo"),
    add: screen.getByRole("button", { name: "Add" }),
  };
};

const failure = "Could not add the todo. Try again.";

/** The error as shown, apart from the live region that says it. */
const shown = (text: string) => screen.queryByText(text, { ignore: '[role="status"]' });

const statusTexts = () => screen.getAllByRole("status").map((status) => status.textContent);

afterEach(() => {
  cleanup();
  fetch.mockClear();
});

describe("TodosForm", () => {
  it("reports a blank title on the field, focuses it, and sends nothing", async () => {
    const { user, input, add } = setup(() => created(""));

    await user.click(add);

    const error = await screen.findByText("Title is required");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(document.activeElement).toBe(input);
    // The focused input says its error; an alert would say it twice, and again on every edit.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    await user.type(input, "Ship it");
    expect(screen.queryByText("Title is required")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("says the error when Enter is pressed in the field, which already has the focus", async () => {
    const { user, input } = setup(() => created(""));

    await user.type(input, "{Enter}");

    await vi.waitFor(() => expect(statusTexts()).toContain("Title is required"));
  });

  it("sends the trimmed title, clears the input, and announces the todo", async () => {
    const requests: Array<unknown> = [];
    const { user, input } = setup(async (request) => {
      requests.push(await request.json());
      return created("Ship it");
    });

    await user.type(input, "  Ship it  {Enter}");

    await vi.waitFor(() => expect(input.value).toBe(""));
    expect(requests).toEqual([{ title: "Ship it" }]);
    expect(await screen.findByText("Added Ship it")).toBeDefined();
  });

  it("keeps the title when the request fails, and drops the error on the next edit", async () => {
    const { user, input } = setup(() => new Response(null, { status: 500 }));

    await user.type(input, "Ship it{Enter}");

    await vi.waitFor(() => expect(statusTexts()).toContain(failure));
    expect(shown(failure)).not.toBeNull();
    expect(input.value).toBe("Ship it");

    await user.type(input, "!");
    expect(screen.queryByText(failure)).toBeNull();
  });

  it("adds the todo on a retry after a failure", async () => {
    const { user, input } = setup(() => new Response(null, { status: 500 }));
    await user.type(input, "Ship it{Enter}");
    await vi.waitFor(() => expect(shown(failure)).not.toBeNull());

    respond = () => created("Ship it");
    await user.keyboard("{Enter}");

    await vi.waitFor(() => expect(input.value).toBe(""));
    expect(screen.queryByText(failure)).toBeNull();
  });

  it("submits once while a request is running, and keeps what was typed meanwhile", async () => {
    const response = Promise.withResolvers<Response>();
    const { user, input, add } = setup(() => response.promise);

    await user.type(input, "First{Enter}");
    await vi.waitFor(() => expect(add.getAttribute("aria-disabled")).toBe("true"));
    await user.type(input, " and more{Enter}");
    // While submitting, the button ignores Enter and clicks; a script or another control may still submit.
    fireEvent.submit(input.form!);
    response.resolve(created("First"));

    await vi.waitFor(() => expect(add.getAttribute("aria-disabled")).toBe("false"));
    expect(input.value).toBe("First and more");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not report a draft emptied during the request, and leaves the focus alone", async () => {
    const response = Promise.withResolvers<Response>();
    const { user, input, add } = setup(() => response.promise);

    await user.type(input, "First{Enter}");
    await user.clear(input);
    await user.tab();
    response.resolve(created("First"));

    await vi.waitFor(() => expect(add.getAttribute("aria-disabled")).toBe("false"));
    // The emptied draft was never submitted: it is not reported, and the focus stays where the user put it.
    expect(screen.queryByText("Title is required")).toBeNull();
    expect(document.activeElement).toBe(add);
  });
});
