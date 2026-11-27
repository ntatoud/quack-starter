import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NewHabitForm } from "#/features/habits/new-habit-form.tsx";

const created = (name: string, color: string) =>
  Response.json({
    id: "1",
    ownerId: "user-1",
    name,
    color,
    position: 0,
    archived: false,
    firstDay: "2026-06-01",
    createdAt: "2026-06-01T08:00:00.000Z",
    versions: [
      { effectiveFrom: "2026-06-01", schedule: { _tag: "EveryDay" }, target: { _tag: "Done" } },
    ],
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
      <NewHabitForm />
    </QueryClientProvider>,
  );

  return {
    name: page.getByRole("textbox", { name: "New habit" }),
    color: page.getByRole("combobox", { name: "Color" }),
    add: page.getByRole("button", { name: "Add" }),
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

describe("NewHabitForm", () => {
  it("reports a blank name and no color on their fields, and sends nothing", async () => {
    const { name, color, add } = await setup(() => created("", "teal"));

    await add.click();

    await expect.element(name).toHaveFocus();
    await expect.element(name).toHaveAccessibleDescription("Name is required");
    await expect.element(color).toHaveAttribute("aria-invalid", "true");
    await expect.element(color).toHaveAccessibleDescription("Choose a color");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates a Habit every Day whose Target is done, clears the form, and announces it", async () => {
    const requests: Array<unknown> = [];

    const { name, color } = await setup(async (request) => {
      requests.push(await request.json());

      return created("Meditate", "teal");
    });

    await name.fill("  Meditate  ");
    await color.click();
    await page.getByRole("option", { name: "Teal" }).click();
    await page.getByRole("button", { name: "Add" }).click();

    await expect.element(name).toHaveValue("");
    expect(requests).toEqual([
      {
        name: "Meditate",
        color: "teal",
        schedule: { _tag: "EveryDay" },
        target: { _tag: "Done" },
      },
    ]);
    await expect.poll(said).toContain("Added Meditate");
  });

  it("keeps what was typed when the request fails, and says so", async () => {
    const { name, color } = await setup(() => new Response(null, { status: 500 }));

    await name.fill("Meditate");
    await color.click();
    await page.getByRole("option", { name: "Teal" }).click();
    await name.click();
    await userEvent.keyboard("{Enter}");

    await expect.poll(said).toContain("Could not add the habit. Try again.");
    await expect.element(name).toHaveValue("Meditate");
  });
});
