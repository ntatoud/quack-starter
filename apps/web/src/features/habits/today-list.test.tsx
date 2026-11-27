import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import type { Target } from "@quack/contracts/habits/habit";

import { TodayList } from "#/features/habits/today-list.tsx";

const day = "2026-06-01";

const done: typeof Target.Encoded = { _tag: "Done" };

const habit = (id: string, name: string, position = 0, target: typeof Target.Encoded = done) => ({
  id,
  ownerId: "user-1",
  name,
  color: "teal",
  position,
  archived: false,
  firstDay: day,
  createdAt: "2026-06-01T08:00:00.000Z",
  versions: [{ effectiveFrom: day, schedule: { _tag: "EveryDay" }, target }],
});

const today = (...habits: ReadonlyArray<{ id: string; name: string; checked: boolean }>) =>
  Response.json({
    day,
    habits: habits.map(({ id, name, checked }, position) => ({
      habit: habit(id, name, position),
      checkIn: checked ? { habitId: id, day, quantity: null } : null,
    })),
  });

const glasses: typeof Target.Encoded = { _tag: "AtLeast", quantity: 8, unit: "glasses" };

/** Today with one Habit, Water, to drink at least 8 glasses, and its total so far, if any. */
const water = (total: number | null, target: typeof Target.Encoded = glasses) =>
  Response.json({
    day,
    habits: [
      {
        habit: habit("1", "Water", 0, target),
        checkIn: total === null ? null : { habitId: "1", day, quantity: total },
      },
    ],
  });

type Sent = { method: string; path: string; body: unknown };

/** Today with Water at `total`, and every request that changes it, answered by `answer`. */
const recording = (total: number | null, answer: () => Response | Promise<Response>) => {
  const sent: Array<Sent> = [];

  const handle = async (request: Request) => {
    if (request.method === "GET") return water(total);

    const text = await request.text();
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text === "" ? null : JSON.parse(text),
    });

    return answer();
  };

  return { sent, handle };
};

const total = page.getByRole("spinbutton", { name: "Total of Water" });
const addOne = page.getByRole("button", { name: "Add 1 to Water" });
const removeOne = page.getByRole("button", { name: "Remove 1 from Water" });
const path = "/api/habits/1/check-ins/2026-06-01";

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
      <TodayList />
    </QueryClientProvider>,
  );
};

const said = () =>
  page
    .getByRole("status")
    .elements()
    .map((status) => status.textContent);

const meditate = page.getByRole("checkbox", { name: "Check in Meditate" });

afterEach(() => {
  fetch.mockClear();
});

describe("TodayList", () => {
  it("says it is loading while Today is on its way", async () => {
    const response = Promise.withResolvers<Response>();
    await setup(() => response.promise);

    await expect.poll(said).toContain("Loading today…");
    response.resolve(today());
  });

  it("says when nothing is due today", async () => {
    await setup(() => today());

    await expect.element(page.getByText("Nothing due today")).toBeVisible();
  });

  it("lists the Habits due today, in order, checked or not", async () => {
    await setup(() =>
      today(
        { id: "1", name: "Meditate", checked: false },
        { id: "2", name: "Read", checked: true },
      ),
    );

    await expect.element(meditate).not.toBeChecked();
    await expect.element(page.getByRole("checkbox", { name: "Check in Read" })).toBeChecked();
    expect(
      page
        .getByRole("checkbox")
        .elements()
        .map((box) => box.getAttribute("aria-label")),
    ).toEqual(["Check in Meditate", "Check in Read"]);
  });

  it("shows a check at once, before the API answers, and keeps it once it has", async () => {
    const answer = Promise.withResolvers<Response>();
    let checked = false;
    const requests: Array<string> = [];
    await setup((request) => {
      if (request.method === "GET") return today({ id: "1", name: "Meditate", checked });
      requests.push(`${request.method} ${new URL(request.url).pathname}`);

      return answer.promise.then((response) => {
        checked = true;

        return response;
      });
    });

    await meditate.click();

    await expect.element(meditate).toBeChecked();
    expect(requests).toEqual(["PUT /api/habits/1/check-ins/2026-06-01"]);
    answer.resolve(Response.json({ habitId: "1", day, quantity: null }));
    await expect.poll(() => fetch.mock.calls.length).toBe(3);
    await expect.element(meditate).toBeChecked();
  });

  it("shows an uncheck at once, and sends it", async () => {
    const answer = Promise.withResolvers<Response>();
    const requests: Array<string> = [];
    await setup((request) => {
      if (request.method === "GET") return today({ id: "1", name: "Meditate", checked: true });
      requests.push(`${request.method} ${new URL(request.url).pathname}`);

      return answer.promise;
    });

    await meditate.click();

    await expect.element(meditate).not.toBeChecked();
    expect(requests).toEqual(["DELETE /api/habits/1/check-ins/2026-06-01"]);
    answer.resolve(new Response(null, { status: 204 }));
  });

  it("takes a check back and says so when the API refuses it", async () => {
    await setup((request) =>
      request.method === "GET"
        ? today({ id: "1", name: "Meditate", checked: false })
        : new Response(null, { status: 500 }),
    );

    await meditate.click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not check in Meditate. Try again.");
    await expect.element(meditate).not.toBeChecked();
  });

  it("takes an uncheck back and says so when the API refuses it", async () => {
    await setup((request) =>
      request.method === "GET"
        ? today({ id: "1", name: "Meditate", checked: true })
        : new Response(null, { status: 500 }),
    );

    await meditate.click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not uncheck Meditate. Try again.");
    await expect.element(meditate).toBeChecked();
  });

  it("shows the Day's total of a quantity Habit against its Target", async () => {
    await setup(() => water(3));

    await expect.element(total).toHaveValue(3);
    await expect.element(page.getByText("at least 8 glasses")).toBeVisible();
    expect(page.getByRole("checkbox").elements()).toEqual([]);
  });

  it("shows no total before the first Check-in, and an at-most Target", async () => {
    await setup(() => water(null, { _tag: "AtMost", quantity: 2, unit: "coffees" }));

    await expect.element(total).toHaveValue(null);
    await expect.element(page.getByText("at most 2 coffees")).toBeVisible();
  });

  it("adds one to the total at once, and sends the new total", async () => {
    const answer = Promise.withResolvers<Response>();
    const { sent, handle } = recording(3, () => answer.promise);

    await setup(handle);

    await addOne.click();

    await expect.element(total).toHaveValue(4);
    await expect.poll(() => sent).toEqual([{ method: "PUT", path, body: { quantity: 4 } }]);
    answer.resolve(Response.json({ habitId: "1", day, quantity: 4 }));
  });

  it("removes one down to a total of 0, which it keeps as a Check-in, and no lower", async () => {
    const { sent, handle } = recording(1, () => Response.json({ habitId: "1", day, quantity: 0 }));

    await setup(handle);

    await removeOne.click();

    await expect.poll(() => sent).toEqual([{ method: "PUT", path, body: { quantity: 0 } }]);
  });

  it("starts the total from 0 before the first Check-in", async () => {
    const { sent, handle } = recording(null, () =>
      Response.json({ habitId: "1", day, quantity: 1 }),
    );

    await setup(handle);

    await addOne.click();

    await expect.poll(() => sent).toEqual([{ method: "PUT", path, body: { quantity: 1 } }]);
  });

  it("cannot remove one from a total of 0", async () => {
    await setup(() => water(0));

    await expect.element(removeOne).toBeDisabled();
    await expect.element(addOne).toBeEnabled();
  });

  it("sends a typed total once the User presses Enter", async () => {
    const { sent, handle } = recording(3, () => Response.json({ habitId: "1", day, quantity: 6 }));

    await setup(handle);

    await total.fill("6");
    expect(sent).toEqual([]);
    await userEvent.keyboard("{Enter}");

    await expect.element(total).toHaveValue(6);
    await expect.poll(() => sent).toEqual([{ method: "PUT", path, body: { quantity: 6 } }]);
  });

  it("sends a typed total when the User leaves the input", async () => {
    const { sent, handle } = recording(3, () => Response.json({ habitId: "1", day, quantity: 0 }));

    await setup(handle);

    await total.fill("0");
    await userEvent.tab();

    await expect.poll(() => sent).toEqual([{ method: "PUT", path, body: { quantity: 0 } }]);
  });

  it("removes the Check-in when the User clears the total", async () => {
    const { sent, handle } = recording(3, () => new Response(null, { status: 204 }));

    await setup(handle);

    await total.clear();
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => sent).toEqual([{ method: "DELETE", path, body: null }]);
  });

  it("sends nothing for a total that is not a whole number, and shows the last one again", async () => {
    const { sent, handle } = recording(3, () => new Response(null, { status: 500 }));

    await setup(handle);

    await total.fill("2.5");
    await userEvent.keyboard("{Enter}");

    await expect.element(total).toHaveValue(3);
    expect(sent).toEqual([]);
  });

  it("takes a total back and says so when the API refuses it", async () => {
    const { handle } = recording(3, () => new Response(null, { status: 500 }));

    await setup(handle);

    await addOne.click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Could not save the total of Water. Try again.");
    await expect.element(total).toHaveValue(3);
  });

  it("offers to try again when Today cannot be loaded, and loads it on the retry", async () => {
    await setup(() => new Response(null, { status: 500 }));

    await expect.element(page.getByRole("alert").getByText("Could not load today")).toBeVisible();

    respond = () => today({ id: "1", name: "Meditate", checked: false });
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(meditate).toBeVisible();
  });
});
