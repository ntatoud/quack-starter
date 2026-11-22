import type { MouseEvent } from "react";
import { isFunction } from "@quack/ui/lib/guards";

export type SortDirection = "asc" | "desc";

/** The column the rows are sorted by, and in which direction. */
export type DataTableSorting<SortColumn extends string = string> = {
  readonly column: SortColumn;
  readonly direction: SortDirection;
};

/**
 * The fields every table has: its page, the text searched, its sorting by one of `SortColumn`, and its hidden
 * columns. A table's state is these and its filters, in one flat object, as a URL holds them: write the filters as
 * a type of their own, `DataTableBaseState<Column> & Filters`. A key left out takes its default.
 */
export type DataTableBaseState<SortColumn extends string = string> = {
  readonly page?: number | undefined;
  /** How many rows a page holds. Left out: the table's `defaultPageSize`. */
  readonly size?: number | undefined;
  readonly q?: string | undefined;
  readonly orderBy?: SortColumn | undefined;
  readonly dir?: SortDirection | undefined;
  /** The ids of the columns hidden. */
  readonly hidden?: ReadonlyArray<string> | undefined;
  /** The ids of the columns pinned at the start of the rows, in the order they were pinned. */
  readonly pinned?: ReadonlyArray<string> | undefined;
};

/** Data, as a URL holds it: text, numbers, booleans, dates, arrays, plain objects, sets and maps. */
export type DataTableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | ReadonlyArray<DataTableValue>
  | ReadonlySet<DataTableValue>
  | ReadonlyMap<DataTableValue, DataTableValue>
  | { readonly [field: string]: DataTableValue };

/** Any state of a table: its base fields and its filters, whose values are data. */
export type DataTableStateValue = DataTableBaseState & { readonly [field: string]: DataTableValue };

/** The fields of a state that hold its filters: every field but the page, the search, the sorting, and the columns hidden or pinned. */
export type DataTableFilterKey<S extends DataTableStateValue> = Exclude<
  keyof S,
  keyof DataTableBaseState
> &
  string;

/** The `href` and `onClick` of an `<a>` that leads to another state of the table, without leaving the app. */
export type DataTableLink = {
  readonly href: string;
  readonly onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * Where the state of a table lives, which the app provides through an adapter: memory, the URL through a router.
 * `update` changes it; `link`, for a store that has addresses, links to the state that `next` makes of it, and
 * the pages of the table are then links rather than buttons.
 */
export type DataTableStore<S extends DataTableStateValue> = {
  readonly state: S;
  readonly update: (next: (state: S) => S, options?: { readonly replace?: boolean }) => void;
  readonly link?: ((next: (state: S) => S) => DataTableLink) | undefined;
};

/**
 * The last field the table changed, the whole state it left, and the state it found: while a router still loads the
 * state asked for, the store holds the one before.
 */
export type DataTableHistory = {
  current: {
    field: string;
    state: string;
    from: string;
    /** The state before the run of changes to this field began. */
    origin: string;
    /** Whether the store has held `state` since: then finding `from` again is Back, not a change on its way. */
    landed: boolean;
  } | null;
};

export type Column<S extends DataTableStateValue> = NonNullable<S["orderBy"]>;

/** A filter's new value, or a function of its current one. `undefined` empties it. */
export type DataTableFilterUpdate<Value> =
  | Value
  | undefined
  | ((current: Value | undefined) => Value | undefined);

const without = <S extends DataTableStateValue>(state: S, ...keys: ReadonlyArray<string>): S =>
  Object.fromEntries(Object.entries(state).filter(([key]) => !keys.includes(key))) as S;

const isPlainObject = (
  value: DataTableValue,
): value is { readonly [field: string]: DataTableValue } => {
  // `Object(value) === value` holds for any object and no primitive, `null` included.
  if (Object(value) !== value) return false;
  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

// The same state gives the same text, whatever the order of its keys and with its empty keys left out: a router
// hands the state back in the order of its schema. A `Set` or a `Map` counts by what it holds.
const fingerprint = (value: DataTableValue): string =>
  JSON.stringify(value, (_key, inner: DataTableValue) => {
    if (inner instanceof Set) return { set: [...inner].map(fingerprint).sort() };

    if (inner instanceof Map) return { map: [...inner].map((entry) => fingerprint(entry)).sort() };

    return isPlainObject(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner;
  });

/**
 * Empty: nothing, `""`, `[]`, an empty set or map, or a plain object whose fields are all empty, such as a range
 * with neither end. A `Date` or any other instance is a value.
 */
export const isEmptyValue = (value: DataTableValue): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  ((value instanceof Set || value instanceof Map) && value.size === 0) ||
  (isPlainObject(value) && Object.values(value).every(isEmptyValue));

type HistoryEntry = NonNullable<DataTableHistory["current"]>;

const withField = <S extends DataTableStateValue>(
  state: S,
  key: string,
  value: DataTableValue,
): S => (value === undefined ? without(state, key) : ({ ...state, [key]: value } as S));

// `id` in the list of ids when `on`, out of it otherwise; an empty list is no list.
const toggled = (list: ReadonlyArray<string> | undefined, id: string, on: boolean) => {
  const others = (list ?? []).filter((other) => other !== id);
  const next = on ? [...others, id] : others;

  return next.length === 0 ? undefined : next;
};

// A column sorted by is a column shown: one hidden would sort rows by an order nothing shows.
const shownForSort = <S extends DataTableStateValue>(state: S, column: string): S =>
  withField(state, "hidden", toggled(state.hidden, column, false));

// A column hidden is unpinned: its pin would come back with it unasked.
const unpinnedWith = <S extends DataTableStateValue>(state: S, id: string, visible: boolean): S =>
  visible ? state : withField(state, "pinned", toggled(state.pinned, id, false));

// Rows sorted by a column out of sight show no order: hiding it goes back to the default sorting, from the first page
// as any other sorting does. (Hiding the default column itself keeps it: the rows need some order.)
const withoutSortedBy = <S extends DataTableStateValue>(
  state: S,
  id: string,
  defaultColumn: string,
): S =>
  state.orderBy === id && id !== defaultColumn ? without(state, "orderBy", "dir", "page") : state;

// A URL may sort by a column it also hides: rows in an order nothing shows take the default sorting instead.
const resolveSorting = <S extends DataTableStateValue>(
  state: S,
  defaultSorting: DataTableSorting<Column<S>>,
) => {
  const hidden =
    state.orderBy !== undefined &&
    state.orderBy !== defaultSorting.column &&
    (state.hidden ?? []).includes(state.orderBy);

  const sorting: DataTableSorting<Column<S>> = hidden
    ? defaultSorting
    : {
        column: (state.orderBy ?? defaultSorting.column) as Column<S>,
        direction: state.dir ?? defaultSorting.direction,
      };

  return { sorting, hidden };
};

const pending = (entry: HistoryEntry | null, found: string) =>
  entry !== null && !entry.landed && entry.from === found;

// The last change, when this one is one more of its run: the same field, from the state it left (or still on its way
// there). A run that comes back to where it started (a search typed, then cleared) pushes: Back then brings back what
// was cleared, rather than doing nothing.
const runOf = (entry: HistoryEntry | null, field: string, found: string, left: string) =>
  entry !== null &&
  entry.field === field &&
  (entry.state === found || pending(entry, found)) &&
  left !== entry.origin
    ? entry
    : undefined;

/**
 * What a table does to its state. Any change of the rows shown starts again from the first page, and a value left
 * empty or at its default leaves the state, so the table writes one form per state (a URL typed by hand may hold
 * another, which reads the same).
 *
 * Changes in a row to the same field, typing a search or ticking the options of one filter, make one history entry:
 * the first pushes, the next replace it. A change that finds the state no longer as the last one left it (after
 * Back, a link, any other navigation) pushes, and one that changes nothing does not happen.
 */
export const dataTableState = <S extends DataTableStateValue>(
  store: DataTableStore<S>,
  defaultSorting: DataTableSorting<Column<S>>,
  {
    filterKeys = [],
    isEmpty = (_key, value) => isEmptyValue(value),
    history = { current: null },
    defaultPageSize = 10,
  }: {
    filterKeys?: ReadonlyArray<DataTableFilterKey<S>>;
    /** How many rows a page holds while the state does not say. */
    defaultPageSize?: number;
    isEmpty?: (key: DataTableFilterKey<S>, value: DataTableValue) => boolean;
    history?: DataTableHistory;
  } = {},
) => {
  // The fields of the table only: a router hands `next` the search of the whole route, a child route's keys
  // included, which the table's own search lacks.
  const ownKeys = new Set<string>([
    "page",
    "size",
    "q",
    "orderBy",
    "dir",
    "hidden",
    "pinned",
    ...filterKeys,
  ]);

  const fingerprintOwn = (state: S) =>
    fingerprint(Object.fromEntries(Object.entries(state).filter(([key]) => ownKeys.has(key))));

  // The store has caught up with the last change once it holds the state that change left: read on every render,
  // and on every change, since a store may apply one before the next render.
  const arrived = () => {
    const found = fingerprintOwn(store.state);

    if (history.current?.state === found) history.current.landed = true;

    return found;
  };

  arrived();

  const { sorting, hidden: sortedHidden } = resolveSorting(store.state, defaultSorting);

  // `valueOf` reads the state the store hands to `next`, not `store.state`: a router may still hold an older one
  // while it loads the last, and a second change in that time builds on the first rather than losing it.
  const set = (
    field: string,
    valueOf: (state: S) => DataTableValue,
    next: (state: S) => S,
    onResolved?: (value: DataTableValue) => void,
  ) => {
    const found = arrived();
    const current = store.state[field];
    const waiting = pending(history.current, found);

    if (!waiting && fingerprint(valueOf(store.state) ?? null) === fingerprint(current ?? null)) {
      onResolved?.(current);

      return;
    }

    const left = fingerprintOwn(next(store.state));
    const run = runOf(history.current, field, found, left);
    const entry = { field, state: left, from: found, origin: run?.origin ?? found, landed: false };
    history.current = entry;
    // The store applies `next` to the state it holds, which may be newer than `store.state`: the entry records what
    // it left, so the store is seen to land it.
    store.update(
      (state) => {
        const result = next(state);
        entry.state = fingerprintOwn(result);

        // After the store's update, which may run while React renders: the callback may set state.
        if (onResolved !== undefined) {
          const value = result[field];
          queueMicrotask(() => onResolved(value));
        }

        return result;
      },
      { replace: run !== undefined },
    );
    // A store that applies a change at once, as memory, has landed it.
    arrived();
  };

  const push = (next: (state: S) => S) => {
    history.current = null;
    store.update(next);
  };

  const sort = ({ column, direction }: DataTableSorting<Column<S>>) =>
    push((state) => {
      const shown = shownForSort(state, column);

      return column === defaultSorting.column && direction === defaultSorting.direction
        ? without(shown, "page", "orderBy", "dir")
        : { ...without(shown, "page"), orderBy: column, dir: direction };
    });

  const onPage = (page: number) => (state: S) =>
    page === 1 ? without(state, "page") : { ...state, page };

  // An empty filter counts as none, whatever its form in the URL (`[]`, `""`, left out).
  const filterValueOf = (key: DataTableFilterKey<S>) => {
    const value = store.state[key];

    return value === undefined || isEmpty(key, value) ? undefined : value;
  };

  const filterValues = filterKeys.map((key) => filterValueOf(key) ?? null);

  const isFiltered =
    (store.state.q ?? "") !== "" || filterKeys.some((key) => filterValueOf(key) !== undefined);

  return {
    /** What the rows shown depend on: the query to the API, or the filtering in memory. */
    state: sortedHidden ? without(store.state, "orderBy", "dir") : store.state,
    page: store.state.page ?? 1,
    /** How many rows a page holds: slice the rows, or ask the API, with it. */
    pageSize: store.state.size ?? defaultPageSize,
    /**
     * Changes how many rows a page holds, and goes back to the first page: the rows of page 3 at another size are
     * other rows. The default size leaves the state.
     */
    setPageSize: (size: number) =>
      push((state) =>
        size === defaultPageSize
          ? without(state, "page", "size")
          : { ...without(state, "page"), size },
      ),
    goToPage: (page: number, options?: { readonly replace?: boolean }) => {
      if (options?.replace === true) {
        history.current = null;
        store.update(onPage(page), { replace: true });
      } else push(onPage(page));
    },
    /** `undefined` when the store has no addresses: offer `goToPage` instead. */
    pageLink: (page: number): DataTableLink | undefined => store.link?.(onPage(page)),
    /** For the `sorting` of `DataTable`. */
    sorting,
    sort,
    /** The `sorted` and `onSort` of the `DataTableColumnHeader` of a column. */
    sortHeader: (column: Column<S>) => ({
      sorted: sorting.column === column ? sorting.direction : undefined,
      onSort: (direction: SortDirection) => sort({ column, direction }),
    }),
    searchText: (text: string) =>
      set(
        "q",
        () => (text === "" ? undefined : text),
        (state) => withField(without(state, "page"), "q", text === "" ? undefined : text),
      ),
    /**
     * Sets a filter, or empties it with `undefined`. Given a function, it computes the value from the current one, as
     * the store holds it once earlier changes land: two ticks in a row both count.
     */
    filter: <Key extends DataTableFilterKey<S>>(
      key: Key,
      value: DataTableFilterUpdate<S[Key]>,
      /** Called with the value the store wrote, once it applies the change: maybe not the one `store.state` gives. */
      onResolved?: (value: S[Key] | undefined) => void,
    ) => {
      const valueOf = (state: S): S[Key] | undefined => {
        const next = isFunction(value)
          ? (value as (current: S[Key] | undefined) => S[Key] | undefined)(state[key])
          : value;

        return next === undefined || isEmpty(key, next) ? undefined : next;
      };

      set(
        key,
        valueOf,
        (state) => withField(without(state, "page"), key, valueOf(state)),
        onResolved as ((value: DataTableValue) => void) | undefined,
      );
    },
    /** The ids of the columns hidden, for the `table` of `DataTable`. */
    hiddenColumns: store.state.hidden ?? [],
    /** Shows or hides a column, on the page it is on: the rows stay the same. */
    // Columns shown or hidden in a row make one history entry, as the ticks of a filter.
    setColumnVisible: (id: string, visible: boolean) => {
      const hiddenOf = (state: S) => toggled(state.hidden, id, !visible);
      set("hidden", hiddenOf, (state) =>
        withField(
          unpinnedWith(withoutSortedBy(state, id, defaultSorting.column), id, visible),
          "hidden",
          hiddenOf(state),
        ),
      );
    },
    /** The ids of the columns pinned at the start, in order, for the `table` of `DataTable`. */
    pinnedColumns: store.state.pinned ?? [],
    /**
     * Pins a column at the start of the rows, after those pinned before it, or unpins it: it stays while the others
     * scroll. A column pinned shows. Pins in a row make one history entry.
     */
    setColumnPinned: (id: string, pinned: boolean) => {
      const pinnedOf = (state: S) => toggled(state.pinned, id, pinned);
      set("pinned", pinnedOf, (state) =>
        withField(pinned ? shownForSort(state, id) : state, "pinned", pinnedOf(state)),
      );
    },
    /** Whether the search or a filter narrows the rows. */
    isFiltered,
    /**
     * Changes with the search or a filter, and only with them, not the page, the sorting or the hidden columns: give
     * it to `useDataTableSelection` as `resetOn` to clear the selection when the rows that match change.
     */
    filtersKey: fingerprint([store.state.q ?? null, ...filterValues]),
    /** Changes whenever other rows show: another page, size, sorting, search or filter. */
    rowsKey: fingerprint([
      store.state.page ?? 1,
      store.state.size ?? defaultPageSize,
      sorting,
      store.state.q ?? null,
      ...filterValues,
    ]),
    /** Clears the search and every filter, and keeps the sorting. */
    reset: () => push((state) => without(state, "page", "q", ...filterKeys)),
  };
};

export type DataTableState<S extends DataTableStateValue> = ReturnType<typeof dataTableState<S>>;
