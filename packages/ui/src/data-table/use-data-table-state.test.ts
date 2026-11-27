import { describe, expect, it } from "vite-plus/test";

import {
  type DataTableFilter,
  type DataTableStore,
  type DataTableValue,
  useDataTable,
} from "@quack/ui/data-table";

import { renderHook } from "vitest-browser-react";

type State = {
  readonly page?: number;
  readonly size?: number;
  readonly q?: string;
  readonly orderBy?: "name" | "createdAt";
  readonly dir?: "asc" | "desc";
  // `""` as a URL holds it: `?status=`.
  readonly status?: "active" | "invited" | "";
  readonly tags?: ReadonlyArray<string>;
  readonly total?: { readonly min?: number; readonly max?: number };
  readonly ids?: ReadonlySet<string>;
  readonly weights?: ReadonlyMap<string, number>;
  readonly value?: DataTableValue;
  readonly hidden?: ReadonlyArray<string>;
  readonly pinned?: ReadonlyArray<string>;
};

const defaults = { column: "name", direction: "asc" } as const;

const statesOf = (updates: ReadonlyArray<{ state: State }>) =>
  updates.map((update) => update.state);

/** A filter the table reads only for its emptiness: these tests drive the state, not the toolbar. */
const filterOf = <Value extends DataTableValue>(
  isEmpty?: (value: Value) => boolean,
): DataTableFilter<Value> => ({
  title: "",
  summary: () => null,
  editor: () => null,
  ...(isEmpty !== undefined && { isEmpty }),
});

/** The table of `store`, rendered once more each time `table()` is called, as on every render of a screen. */
const tableOf = async (
  store: DataTableStore<State>,
  {
    defaultPageSize,
    statusIsEmpty,
  }: {
    defaultPageSize?: number;
    statusIsEmpty?: (value: NonNullable<State["status"]>) => boolean;
  } = {},
) => {
  const { result, rerender } = await renderHook(() =>
    useDataTable({
      store,
      defaultSorting: defaults,
      ...(defaultPageSize !== undefined && { defaultPageSize }),
      filters: {
        status: filterOf(statusIsEmpty),
        tags: filterOf<ReadonlyArray<string>>(),
        total: filterOf<NonNullable<State["total"]>>(),
        ids: filterOf<ReadonlySet<string>>(),
        weights: filterOf<ReadonlyMap<string, number>>(),
        value: filterOf<NonNullable<DataTableValue>>(),
      },
    }),
  );

  return async () => {
    await rerender();

    return result.current;
  };
};

const memoryStore = async (
  initial: State,
  {
    addresses = true,
    ...tableOptions
  }: { addresses?: boolean } & NonNullable<Parameters<typeof tableOf>[1]> = {},
) => {
  const updates: Array<{ state: State; replace: boolean }> = [];
  let current = initial;

  const store: DataTableStore<State> = {
    get state() {
      return current;
    },
    update: (next, options) => {
      current = next(current);
      updates.push({ state: current, replace: options?.replace ?? false });
    },
    ...(addresses && {
      link: (next: (state: State) => State) => ({
        href: JSON.stringify(next(initial)),
        onClick: () => {},
      }),
    }),
  };

  const table = await (await tableOf(store, tableOptions))();

  return {
    table,
    updates,
    /** Another state arrives from outside, as on Back. */
    arrive: (state: State) => {
      current = state;
    },
  };
};

describe("useDataTable", () => {
  it("answers the sorting of the state, or the default", async () => {
    expect((await memoryStore({})).table.sorting).toEqual(defaults);
    expect((await memoryStore({ orderBy: "createdAt" })).table.sorting).toEqual({
      column: "createdAt",
      direction: "asc",
    });
  });

  it("sorts from the first page, and leaves the default sorting out of the state", async () => {
    const { table, updates } = await memoryStore({ page: 3, status: "active" });

    table.sort({ column: "createdAt", direction: "desc" });
    table.sort(defaults);

    expect(statesOf(updates)).toEqual([
      { status: "active", orderBy: "createdAt", dir: "desc" },
      { status: "active" },
    ]);
  });

  it("gives a column header its sorting, and sorts by its column", async () => {
    const { table, updates } = await memoryStore({
      orderBy: "createdAt",
      dir: "desc",
    });

    expect(table.sortHeader("createdAt").sorted).toBe("desc");
    expect(table.sortHeader("name").sorted).toBeUndefined();
    table.sortHeader("name").onSort("desc");

    expect(statesOf(updates)).toEqual([{ orderBy: "name", dir: "desc" }]);
  });

  it("links to a page, keeping the rest of the state, with no page for the first", async () => {
    const { table } = await memoryStore({ page: 2, status: "active" });

    expect(table.page).toBe(2);
    expect(JSON.parse(table.pageLink(3)?.href ?? "")).toEqual({
      page: 3,
      status: "active",
    });
    expect(JSON.parse(table.pageLink(1)?.href ?? "")).toEqual({
      status: "active",
    });
    expect((await memoryStore({})).table.page).toBe(1);
  });

  it("has no page links without addresses, and goes to a page all the same", async () => {
    const { table, updates } = await memoryStore(
      { page: 3, status: "active" },
      { addresses: false },
    );

    expect(table.pageLink(2)).toBeUndefined();
    table.goToPage(2);
    table.goToPage(1);

    expect(statesOf(updates)).toEqual([{ page: 2, status: "active" }, { status: "active" }]);
  });

  it("goes to a page in place of the current history entry, on demand", async () => {
    const { table, updates } = await memoryStore({ page: 3 });

    table.goToPage(4, { replace: true });

    expect(updates).toEqual([{ state: { page: 4 }, replace: true }]);
  });

  it("searches from the first page, in one history entry for the whole search, and drops an empty text", async () => {
    const { table, updates } = await memoryStore({ page: 2, q: "ada" });

    table.searchText("grace");
    table.searchText("grace h");
    table.searchText("");

    expect(updates).toEqual([
      { state: { q: "grace" }, replace: false },
      { state: { q: "grace h" }, replace: true },
      { state: {}, replace: true },
    ]);
  });

  it("starts a new history entry once the field is no longer as the table left it", async () => {
    const { table, updates, arrive } = await memoryStore({});

    table.searchText("grace");
    arrive({});
    table.searchText("ada");
    table.filter("status", "active");
    table.filter("tags", ["vip"]);
    table.filter("tags", ["vip", "beta"]);

    expect(updates.map((update) => update.replace)).toEqual([false, false, false, false, true]);
  });

  it("pushes a change that follows a move the table did not make, such as a page link", async () => {
    const { table, updates, arrive } = await memoryStore({});

    table.filter("status", "active");
    arrive({ status: "active", page: 2 });
    table.filter("status", "invited");

    expect(updates.map((update) => update.replace)).toEqual([false, false]);
  });

  it("does not write a value the state already holds", async () => {
    const { table, updates } = await memoryStore({
      status: "active",
      total: { min: 10 },
      q: "ada",
    });

    table.filter("status", "active");
    table.filter("total", { min: 10 });
    table.searchText("ada");

    expect(updates).toEqual([]);
  });

  it("says whether the search or a filter narrows the rows, and resets them but the sorting", async () => {
    expect((await memoryStore({ orderBy: "createdAt", page: 2 })).table.isFiltered).toBe(false);
    expect((await memoryStore({ total: {} })).table.isFiltered).toBe(false);

    const { table, updates } = await memoryStore({
      orderBy: "createdAt",
      page: 2,
      q: "ada",
      status: "active",
      total: { min: 10 },
    });

    expect(table.isFiltered).toBe(true);
    table.reset();

    expect(updates).toEqual([{ state: { orderBy: "createdAt" }, replace: false }]);
  });

  it("drops a range with neither end, as an empty filter", async () => {
    const { table, updates } = await memoryStore({ total: { min: 10 } });

    table.filter("total", {});

    expect(statesOf(updates)).toEqual([{}]);
  });

  it.each<{ value: DataTableValue; empty: boolean }>([
    { value: { min: undefined }, empty: true },
    { value: { from: undefined, to: undefined }, empty: true },
    { value: new Set(), empty: true },
    { value: { min: 0 }, empty: false },
    { value: new Date(0), empty: false },
    { value: { from: new Date(0) }, empty: false },
    { value: new Set(["a"]), empty: false },
  ])("drops the filter set to $value when it is empty: $empty", async ({ value, empty }) => {
    const { table, updates } = await memoryStore({ value: "before" });

    table.filter("value", value);

    expect(statesOf(updates)).toEqual([empty ? {} : { value }]);
  });

  it("writes a set whose members change", async () => {
    const { table, updates } = await memoryStore({ ids: new Set(["a"]) });

    table.filter("ids", new Set(["a", "b"]));
    table.filter("ids", new Set(["b", "a"]));

    expect(updates.map((update) => Array.from(update.state.ids ?? []))).toEqual([["a", "b"]]);
  });

  it("filters from the first page, and drops a filter with no value", async () => {
    const { table, updates } = await memoryStore({ page: 2, tags: ["vip"] });

    table.filter("status", "invited");
    table.filter("tags", []);
    table.filter("status", undefined);

    expect(statesOf(updates)).toEqual([
      { tags: ["vip"], status: "invited" },
      { status: "invited" },
      {},
    ]);
  });
});

describe("useDataTable page size", () => {
  it("answers the size of the state, or the default", async () => {
    expect((await memoryStore({})).table.pageSize).toBe(10);
    expect((await memoryStore({ size: 25 })).table.pageSize).toBe(25);
  });

  it("changes the size and goes back to the first page, leaving the default out", async () => {
    const { table, updates } = await memoryStore({ page: 3, status: "active" });

    table.setPageSize(50);
    expect(updates.at(-1)?.state).toEqual({ status: "active", size: 50 });

    table.setPageSize(10);
    expect(updates.at(-1)?.state).toEqual({ status: "active" });
  });
});

describe("useDataTable filtersKey", () => {
  it("changes with the search or a filter, not with the page, the sorting or the size", async () => {
    const key = async (state: State) => (await memoryStore(state)).table.filtersKey;
    const base = await key({ q: "ada", status: "active" });

    expect(await key({ q: "ada", status: "active", page: 2, size: 50 })).toBe(base);
    expect(await key({ q: "ada", status: "active", orderBy: "createdAt" })).toBe(base);
    expect(await key({ q: "alan", status: "active" })).not.toBe(base);
    expect(await key({ q: "ada", status: "invited" })).not.toBe(base);
  });
});

describe("useDataTable history with a store that lags", () => {
  // A router: `state` is the one it shows, which lags behind the changes it has taken, applied to its newest state.
  const laggingStore = async () => {
    const updates: Array<{ state: State; replace: boolean }> = [];
    let shown: State = {};
    let newest: State = {};

    const store: DataTableStore<State> = {
      get state() {
        return shown;
      },
      update: (next, options) => {
        newest = next(newest);
        updates.push({ state: newest, replace: options?.replace ?? false });
      },
    };

    return {
      updates,
      /** A render: the table as the store shows it now. */
      table: await tableOf(store),
      /** The store shows the newest state at last. */
      land: () => {
        shown = newest;
      },
    };
  };

  it("shows and hides columns in one history entry, though the store has not shown the first change yet", async () => {
    const { table, updates, land } = await laggingStore();

    (await table()).setColumnVisible("name", false);
    (await table()).setColumnVisible("total", false);
    land();
    await table();
    (await table()).setColumnVisible("name", true);

    expect(updates).toEqual([
      { state: { hidden: ["name"] }, replace: false },
      { state: { hidden: ["name", "total"] }, replace: true },
      { state: { hidden: ["total"] }, replace: true },
    ]);
  });

  it("pushes a column toggle that follows another change", async () => {
    const { table, updates } = await laggingStore();

    (await table()).sort({ column: "createdAt", direction: "desc" });
    (await table()).setColumnVisible("name", false);

    expect(updates.map((update) => update.replace)).toEqual([false, false]);
  });
});

describe("useDataTable columns and sorting", () => {
  it("drops the sorting with the column it sorts by, and goes back to the first page, in the same entry", async () => {
    const { table, updates } = await memoryStore({
      page: 2,
      orderBy: "createdAt",
      dir: "desc",
    });

    table.setColumnVisible("createdAt", false);

    expect(updates).toEqual([{ state: { hidden: ["createdAt"] }, replace: false }]);
  });

  it("keeps the sorting and the page when the default column hides", async () => {
    const { table, updates } = await memoryStore({
      orderBy: "name",
      dir: "desc",
      page: 2,
    });

    table.setColumnVisible("name", false);

    expect(statesOf(updates)).toEqual([
      { orderBy: "name", dir: "desc", page: 2, hidden: ["name"] },
    ]);
  });

  it("shows the column it sorts by: a URL hiding every column can be sorted all the same", async () => {
    const { table, updates } = await memoryStore({
      hidden: ["name", "createdAt"],
    });

    table.sort({ column: "createdAt", direction: "desc" });

    expect(statesOf(updates)).toEqual([{ hidden: ["name"], orderBy: "createdAt", dir: "desc" }]);
  });

  it("keeps the sorting when another column hides", async () => {
    const { table, updates } = await memoryStore({ orderBy: "createdAt" });

    table.setColumnVisible("name", false);

    expect(statesOf(updates)).toEqual([{ orderBy: "createdAt", hidden: ["name"] }]);
  });
});

describe("useDataTable history with a store that holds more than the table", () => {
  it("merges a search typed in a row, though the store hands `next` keys of another route", async () => {
    const updates: Array<{ state: State; replace: boolean }> = [];
    // The URL holds a key of a child route; the table's state, what its route validated, does not.
    let url: State & { readonly userId?: string } = { userId: "7" };

    const store: DataTableStore<State> = {
      get state() {
        const { userId: _userId, ...state } = url;

        return state;
      },
      update: (next, options) => {
        url = next(url);
        updates.push({ state: url, replace: options?.replace ?? false });
      },
    };

    const table = await tableOf(store);

    (await table()).searchText("a");
    (await table()).searchText("ad");
    (await table()).searchText("ada");

    expect(updates.map((update) => update.replace)).toEqual([false, true, true]);
    expect(updates.at(-1)?.state).toEqual({ userId: "7", q: "ada" });
  });
});

describe("useDataTable history origin", () => {
  it("pushes the change of a run that brings the field back to where the run started, so Back finds the run", async () => {
    const { table, updates } = await memoryStore({});

    table.searchText("a");
    table.searchText("ab");
    table.searchText("abc");
    table.searchText("");

    expect(updates).toEqual([
      { state: { q: "a" }, replace: false },
      { state: { q: "ab" }, replace: true },
      { state: { q: "abc" }, replace: true },
      { state: {}, replace: false },
    ]);
  });
});

describe("useDataTable sorting by a hidden column", () => {
  it("sorts by the default when the URL sorts by a column it hides, and leaves that sorting out of the state", async () => {
    const { table } = await memoryStore({
      orderBy: "createdAt",
      dir: "desc",
      hidden: ["createdAt"],
    });

    expect(table.sorting).toEqual(defaults);
    expect(table.state).toEqual({ hidden: ["createdAt"] });
  });

  it("keeps the sorting of the default column, though hidden", async () => {
    const { table } = await memoryStore({
      orderBy: "name",
      dir: "desc",
      hidden: ["name"],
    });

    expect(table.sorting).toEqual({ column: "name", direction: "desc" });
  });
});

describe.each(["filtersKey", "rowsKey"] as const)("useDataTable %s and empty filters", (name) => {
  it("gives an empty filter the key of no filter", async () => {
    const key = async (state: State) => (await memoryStore(state)).table[name];
    const none = await key({});

    expect(await key({ tags: [] })).toBe(none);
    expect(await key({ total: {} })).toBe(none);
    expect(await key({ status: "" })).toBe(none);
    expect(await key({ weights: new Map() })).toBe(none);
    expect(await key({ tags: ["vip"] })).not.toBe(none);
    expect(await key({ status: "active" })).not.toBe(none);
  });
});

describe("useDataTable pinned columns", () => {
  it("pins columns in the order they were pinned, in one history entry for a run", async () => {
    const { table, updates } = await memoryStore({ page: 2 });

    table.setColumnPinned("createdAt", true);
    table.setColumnPinned("name", true);

    expect(table.pinnedColumns).toEqual([]);
    expect(updates).toEqual([
      { state: { page: 2, pinned: ["createdAt"] }, replace: false },
      { state: { page: 2, pinned: ["createdAt", "name"] }, replace: true },
    ]);
    expect((await memoryStore({ pinned: ["createdAt", "name"] })).table.pinnedColumns).toEqual([
      "createdAt",
      "name",
    ]);
  });

  it("unpins a column, and leaves pinned out of the state once none is left", async () => {
    const { table, updates } = await memoryStore({ pinned: ["createdAt", "name"] });

    table.setColumnPinned("createdAt", false);
    table.setColumnPinned("name", false);

    expect(statesOf(updates)).toEqual([{ pinned: ["name"] }, {}]);
  });

  it("shows a hidden column it pins", async () => {
    const { table, updates } = await memoryStore({ hidden: ["name", "createdAt"] });

    table.setColumnPinned("name", true);

    expect(statesOf(updates)).toEqual([{ hidden: ["createdAt"], pinned: ["name"] }]);
  });

  it("unpins a column it hides", async () => {
    const { table, updates } = await memoryStore({ pinned: ["name", "createdAt"] });

    table.setColumnVisible("name", false);

    expect(statesOf(updates)).toEqual([{ hidden: ["name"], pinned: ["createdAt"] }]);
  });

  it("keeps pins out of what the rows depend on", async () => {
    const keys = async (state: State) => {
      const { table } = await memoryStore(state);

      return [table.filtersKey, table.rowsKey, table.isFiltered];
    };

    expect(await keys({ pinned: ["name"] })).toEqual(await keys({}));
  });
});

describe("useDataTable options", () => {
  it("reads the size of a page from defaultPageSize while the state does not say, and leaves it out", async () => {
    const { table, updates } = await memoryStore({ page: 2, size: 50 }, { defaultPageSize: 25 });

    table.setPageSize(25);

    expect(statesOf(updates)).toEqual([{}]);
    expect((await memoryStore({}, { defaultPageSize: 25 })).table.pageSize).toBe(25);
  });

  it("drops a filter that its isEmpty says is empty", async () => {
    const { table, updates } = await memoryStore(
      { status: "active" },
      { statusIsEmpty: (value) => value === "invited" },
    );

    table.filter("status", "invited");

    expect(statesOf(updates)).toEqual([{}]);
  });
});

describe("useDataTable filters of a Map", () => {
  it("counts a Map by what it holds, not the order it was filled in", async () => {
    const { table, updates } = await memoryStore({
      weights: new Map([
        ["a", 1],
        ["b", 2],
      ]),
    });

    table.filter(
      "weights",
      new Map([
        ["b", 2],
        ["a", 1],
      ]),
    );

    expect(updates).toEqual([]);

    table.filter("weights", new Map([["a", 3]]));
    expect(statesOf(updates)).toEqual([{ weights: new Map([["a", 3]]) }]);
  });
});

describe("useDataTable filter from the current value", () => {
  it("computes the value from the one the store holds", async () => {
    const { table, updates } = await memoryStore({ tags: ["vip"] });

    table.filter("tags", (tags) => [...(tags ?? []), "beta"]);

    expect(statesOf(updates)).toEqual([{ tags: ["vip", "beta"] }]);
  });

  it("writes nothing when the value computed is the one held", async () => {
    const { table, updates } = await memoryStore({ tags: ["vip"] });

    table.filter("tags", (tags) => tags);

    expect(updates).toEqual([]);
  });
});
