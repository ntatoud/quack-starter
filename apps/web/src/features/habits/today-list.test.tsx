import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { TodayList } from "#/features/habits/today-list.tsx";

const day = "2026-06-01";

type Entry = {
  id: string;
  name: string;
  checked: boolean;
  thisWeek?: { checkIns: number; times: number };
};

const habit = ({ id, name, thisWeek }: Entry, position: number) => ({
  id,
  ownerId: "user-1",
  name,
  color: "teal",
  position,
  archived: false,
  firstDay: day,
  createdAt: "2026-06-01T08:00:00.000Z",
  versions: [
    {
      effectiveFrom: day,
      schedule: thisWeek ? { _tag: "Weekly", times: thisWeek.times } : { _tag: "EveryDay" },
      target: { _tag: "Done" },
    },
  ],
});

const entryOf = (entry: Entry, position: number) => ({
  habit: habit(entry, position),
  checkIn: entry.checked ? { habitId: entry.id, day } : null,
  thisWeek: entry.thisWeek ?? null,
});

const today = (...habits: ReadonlyArray<Entry>) => todayWith(habits, []);

const todayWith = (habits: ReadonlyArray<Entry>, doneThisWeek: ReadonlyArray<Entry>) =>
  Response.json({
    day,
    habits: habits.map(entryOf),
    doneThisWeek: doneThisWeek.map((entry, position) => entryOf(entry, habits.length + position)),
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
    answer.resolve(Response.json({ habitId: "1", day }));
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

  it("offers to try again when Today cannot be loaded, and loads it on the retry", async () => {
    await setup(() => new Response(null, { status: 500 }));

    await expect.element(page.getByRole("alert").getByText("Could not load today")).toBeVisible();

    respond = () => today({ id: "1", name: "Meditate", checked: false });
    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(meditate).toBeVisible();
  });

  it("shows the week's progress of a Habit a number of times a week", async () => {
    await setup(() =>
      today(
        { id: "1", name: "Meditate", checked: false },
        { id: "2", name: "Swim", checked: true, thisWeek: { checkIns: 2, times: 3 } },
      ),
    );

    await expect.element(page.getByText("2/3 this week")).toBeVisible();
    expect(page.getByText(/this week/).elements()).toHaveLength(1);
  });

  it("lists the Habits done this week in their own section, where they can still be checked in", async () => {
    const requests: Array<string> = [];
    let checked = false;
    await setup((request) => {
      if (request.method === "GET") {
        return todayWith(
          [{ id: "1", name: "Meditate", checked: false }],
          [{ id: "2", name: "Swim", checked, thisWeek: { checkIns: checked ? 4 : 3, times: 3 } }],
        );
      }

      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      checked = true;

      return Response.json({ habitId: "2", day });
    });

    const doneThisWeek = page.getByRole("region", { name: "Done this week" });
    const swim = doneThisWeek.getByRole("checkbox", { name: "Check in Swim" });

    await expect.element(swim).not.toBeChecked();
    await expect.element(doneThisWeek.getByText("3/3 this week")).toBeVisible();
    expect(doneThisWeek.getByRole("checkbox", { name: "Check in Meditate" }).elements()).toEqual(
      [],
    );

    await swim.click();

    await expect.element(doneThisWeek.getByText("4/3 this week")).toBeVisible();
    await expect.element(swim).toBeChecked();
    expect(requests).toEqual(["PUT /api/habits/2/check-ins/2026-06-01"]);
  });

  it("leaves out the section of the Habits done this week when there is none", async () => {
    await setup(() => today({ id: "1", name: "Meditate", checked: false }));

    await expect.element(meditate).toBeVisible();
    expect(page.getByRole("region", { name: "Done this week" }).elements()).toEqual([]);
  });

  it("says nothing is left today when every Habit due is done this week", async () => {
    await setup(() =>
      todayWith(
        [],
        [{ id: "2", name: "Swim", checked: false, thisWeek: { checkIns: 1, times: 1 } }],
      ),
    );

    await expect.element(page.getByText("Nothing left today")).toBeVisible();
    await expect.element(page.getByRole("checkbox", { name: "Check in Swim" })).toBeVisible();
  });
});
