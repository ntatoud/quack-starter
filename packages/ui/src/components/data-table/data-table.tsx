import {
  type Cell,
  type ColumnDef,
  type Header,
  type ReactTable,
  type Row,
  type RowData,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem, type Virtualizer } from "@tanstack/react-virtual";
import {
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import type { ComponentProps, ReactNode } from "react";
import * as React from "react";

import { cn } from "@quack/ui/lib/utils";

import { DataTableColumnHeader } from "@quack/ui/components/data-table/column-header";
import { RowSelectionRoot } from "@quack/ui/components/data-table/row-selection-parts";
import { onRowKeyDown } from "@quack/ui/lib/data-table/row-keyboard";
import { useEmptySlot } from "@quack/ui/lib/data-table/use-empty-slot";
import { type Pin, selectColumnId, usePinLayout } from "@quack/ui/lib/data-table/use-pin-layout";
import { useRowFocus } from "@quack/ui/lib/data-table/use-row-focus";
import type { RowSelectionRow as RowOfSelection } from "@quack/ui/lib/data-table/row-selection";
import {
  type DataTableSelection,
  SelectableRow,
  SelectAllCheckbox,
  SelectRowCheckbox,
} from "@quack/ui/components/data-table/selection";
import type {
  DataTableFilterKey,
  DataTableSorting,
  DataTableStateValue,
  SortDirection,
} from "@quack/ui/lib/data-table/state";
import { ScrollBar } from "@quack/ui/components/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@quack/ui/components/table";

const features = tableFeatures({});

const ariaSort = { asc: "ascending", desc: "descending" } as const;

export type ColumnDefOf<TData extends RowData> = ColumnDef<
  typeof features,
  TData,
  // oxlint-disable-next-line typescript/no-explicit-any -- the columns of one table hold values of different types
  any
>;

// `ColumnDef` is a union of the accessor and display columns: omit from each, not from what they share.
export type OmitEach<T, Key extends PropertyKey> = T extends unknown ? Omit<T, Key> : never;

/** What the headers of a table read from it, which `useDataTable` answers. */
export type DataTableHeaders<Sort extends string = string, FilterKey extends string = string> = {
  readonly sorting: DataTableSorting<Sort>;
  readonly sortHeader: (column: Sort) => {
    sorted: SortDirection | undefined;
    onSort: (direction: SortDirection) => void;
  };
  readonly openFilter: (key: FilterKey | "search") => void;
  /** Whether a header can offer `target` as its filter: the search only while the toolbar shows one. */
  readonly canFilter?: (target: FilterKey | "search") => boolean;
  readonly hiddenColumns?: ReadonlyArray<string>;
  /** The ids of the columns pinned at the start of the rows, in order. */
  readonly pinnedColumns?: ReadonlyArray<string>;
  /** Changes whenever other rows show (a page, a sorting, a search): the rows scroll back to the top. */
  readonly rowsKey?: string;
};

/** How a column sits in its row, whether its header is built by the table or not. */
export type ColumnLayout = {
  /** `'end'`: the column stays at the end of the row while the others scroll, as narrow as its content. */
  readonly sticky?: "end";
  /** `true`: the column is as narrow as its content, such as the actions of a row. */
  readonly shrink?: boolean;
  /** `'end'`: the header and cells sit at the end, for numbers and amounts, in tabular figures. */
  readonly align?: "start" | "end";
  /**
   * The width of the column, in pixels, at least: rows narrower keep it from one page to the next; a value wider than
   * it widens the column, as cells do not wrap.
   */
  readonly size?: number;
};

/**
 * A column whose header the table builds from its `title`: sorted by its `id` when `sortable`, which must then be a
 * column the state sorts by, and with a shortcut to the filter `filter`, a filter of the table or `"search"`.
 */
export type DataTableTitledColumn<
  TData extends RowData,
  Sort extends string = string,
  FilterKey extends string = string,
> = OmitEach<ColumnDefOf<TData>, "header" | "id" | "columns"> & {
  readonly title: string;
  readonly filter?: FilterKey | "search";
  readonly columns?: never;
} & ColumnLayout &
  (
    | { readonly id: Sort; readonly sortable: true }
    | { readonly id: string; readonly sortable?: false }
  );

/**
 * Columns under one header, which spans them: a column split in two, or more. Its header sorts nothing, and may
 * hold a shortcut to the filter `filter`.
 */
export type DataTableColumnGroup<
  TData extends RowData,
  Sort extends string = string,
  FilterKey extends string = string,
> = {
  readonly id: string;
  readonly title: string;
  readonly columns: ReadonlyArray<DataTableColumn<TData, Sort, FilterKey>>;
  readonly sortable?: never;
  readonly filter?: FilterKey | "search";
};

/** A column: titled, its header built by the table, with a `header` of its own, or a group of columns. */
export type DataTableColumn<
  TData extends RowData,
  Sort extends string = string,
  FilterKey extends string = string,
> =
  | DataTableTitledColumn<TData, Sort, FilterKey>
  | DataTableColumnGroup<TData, Sort, FilterKey>
  | (OmitEach<ColumnDefOf<TData>, "columns"> & {
      readonly columns?: never;
      readonly title?: never;
      readonly sortable?: never;
      readonly filter?: never;
    } & ColumnLayout);

/**
 * The columns of a table over the state `S`: sorted by the columns it sorts by, filtered by its filters. A table
 * with a filter for only some fields of its state names them in `FilterKey`.
 */
export type DataTableColumnFor<
  TData extends RowData,
  S extends DataTableStateValue,
  FilterKey extends DataTableFilterKey<S> = DataTableFilterKey<S>,
> = DataTableColumn<TData, NonNullable<S["orderBy"]>, FilterKey>;

const filterOpener = (
  column: DataTableTitledColumn<RowData>,
  table: DataTableHeaders | undefined,
) => {
  const { filter } = column;

  if (filter === undefined || table === undefined || !(table.canFilter?.(filter) ?? true))
    return undefined;

  return () => table.openFilter(filter);
};

function TitledHeader({
  column,
  table,
}: {
  column: DataTableTitledColumn<RowData>;
  table: DataTableHeaders | undefined;
}) {
  const onFilter = filterOpener(column, table);
  const align = column.align ?? "start";

  if (column.sortable === true && table !== undefined)
    return (
      <DataTableColumnHeader
        title={column.title}
        align={align}
        {...table.sortHeader(column.id)}
        {...(onFilter !== undefined && { onFilter })}
      />
    );

  if (onFilter !== undefined)
    return <DataTableColumnHeader title={column.title} align={align} onFilter={onFilter} />;

  return column.title;
}

type AnyColumn = DataTableColumn<RowData> | ColumnDefOf<RowData>;

const isTitled = (column: AnyColumn): column is DataTableTitledColumn<RowData> =>
  "title" in column && column.title !== undefined;

const isGroup = (column: AnyColumn): column is DataTableColumnGroup<RowData> =>
  isTitled(column) && "columns" in column && Array.isArray(column.columns);

/** The columns but the hidden ones, and a group whose columns are all hidden. */
const visibleColumns = <Column extends DataTableColumn<RowData>>(
  columns: ReadonlyArray<Column>,
  hidden: ReadonlySet<string>,
): ReadonlyArray<Column> =>
  columns.flatMap((column) => {
    // Only a column with a title hides: the menu of columns lists no other, so nothing would bring it back.
    if (!isGroup(column))
      return isTitled(column) && column.id !== undefined && hidden.has(column.id) ? [] : [column];
    const kept = visibleColumns(column.columns, hidden);

    return kept.length === 0 ? [] : [{ ...column, columns: kept }];
  });

const hasTitledLeaf = (columns: ReadonlyArray<DataTableColumn<RowData>>): boolean =>
  columns.some((column) => (isGroup(column) ? hasTitledLeaf(column.columns) : isTitled(column)));

/** The layout a column asks for: read from its definition, which TanStack hands back as it was given. */
const layoutOf = <TData extends RowData>(column: ColumnDefOf<TData>, id: string) => {
  const layout = column as ColumnLayout;

  return {
    sticky: layout.sticky === "end" ? ("end" as const) : false,
    shrink: layout.shrink === true || id === selectColumnId,
    align: layout.align ?? "start",
    size: layout.size,
  };
};

// Declared once: a header or cell renderer made anew is a new component, whose checkboxes would mount again (and lose
// the focus) whenever the columns change.
const SelectHeader = () => <SelectAllCheckbox />;
const SelectCell = ({ row }: { row: { id: string } }) => <SelectRowCheckbox rowId={row.id} />;

const selectColumn: ColumnDefOf<RowData> = {
  id: selectColumnId,
  header: SelectHeader,
  cell: SelectCell,
};

// What a click on a row leaves alone: its own controls, and what renders outside it (a menu, a dialog opened from it,
// whose React events still bubble through the row).
const interactive =
  "a, button, input, select, textarea, label, summary, [role=button], [role=link], [role=menuitem], [role=checkbox], [role=switch], [data-row-click-ignore]";

const rowLinkSlot = "data-table-row-link";

// The controls of a cell stay above the link that covers it, and keep their own action.
const controlsAboveRowLink =
  "[&_:is(button,input,select,textarea,label,summary,[role=button],[role=checkbox],[role=switch],[role=menuitem],a:not([data-slot=data-table-row-link]))]:relative [&_:is(button,input,select,textarea,label,summary,[role=button],[role=checkbox],[role=switch],[role=menuitem],a:not([data-slot=data-table-row-link]))]:z-2";

const isOwnClick = (event: React.MouseEvent<HTMLElement>) => {
  const target = event.target as Element;

  if (!event.currentTarget.contains(target)) return false;
  const control = target.closest(interactive);

  if (control !== null && event.currentTarget.contains(control)) return false;

  // A drag that selected text is not a click.
  return (window.getSelection()?.toString() ?? "") === "";
};

const definitionOf = (column: DataTableColumn<RowData>): ColumnDefOf<RowData> => {
  if (isGroup(column))
    return {
      ...column,
      header: column.title,
      columns: column.columns.map(definitionOf),
    };

  return isTitled(column) ? { ...column, header: column.title } : column;
};

/** The title of the column `id`, among groups too. */
const titleOf = (
  columns: ReadonlyArray<DataTableColumn<RowData>>,
  id: string,
): string | undefined => {
  for (const column of columns) {
    if (isGroup(column)) {
      const inner = titleOf(column.columns, id);

      if (inner !== undefined) return inner;
    } else if (column.id === id && isTitled(column)) return column.title;
  }

  return undefined;
};

/** Watches the width of an element and the height of another, in pixels. */
const useSize = (
  width: React.RefObject<HTMLElement | null>,
  height: React.RefObject<HTMLElement | null>,
) => {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    const measure = () =>
      setSize({
        width: width.current?.clientWidth ?? 0,
        height: height.current?.offsetHeight ?? 0,
      });

    measure();
    const observer = new ResizeObserver(measure);

    if (width.current !== null) observer.observe(width.current);

    if (height.current !== null) observer.observe(height.current);

    return () => observer.disconnect();
  }, [width, height]);

  return size;
};

export type RowClickEvent =
  | React.MouseEvent<HTMLTableRowElement>
  | React.KeyboardEvent<HTMLTableRowElement>;

/** The root of the table: with a selection, the root of its primitive (the table is named for an agent by it). */
function TableRoot({
  selection,
  label,
  ...props
}: {
  selection?: {
    selected: ReadonlySet<string>;
    onSelectedChange: (selected: ReadonlySet<string>) => void;
    rows: ReadonlyArray<RowOfSelection>;
    allRows: boolean;
  };
  label?: string | undefined;
} & Omit<ComponentProps<"div">, "className"> & { className: string }) {
  if (selection === undefined) return <div data-slot="data-table" {...props} />;

  return (
    <RowSelectionRoot
      {...selection}
      {...(label !== undefined && { "aria-label": label })}
      {...props}
    />
  );
}

export type RowLink<TData> = (row: TData) => React.ReactElement<{
  className?: string;
  tabIndex?: number;
  "aria-hidden"?: boolean;
  "data-slot"?: string;
}>;

/** What the parts of the table (its headers, rows and cells) read from it, so they need no props to carry it. */
type View<TData extends RowData> = {
  readonly table: ReactTable<typeof features, TData>;
  readonly headers: DataTableHeaders | undefined;
  readonly pins: ReturnType<typeof usePinLayout>["pins"];
  readonly focus: ReturnType<typeof useRowFocus>;
  readonly viewport: React.RefObject<HTMLDivElement | null>;
  readonly headerHeight: number;
  readonly headerRowCount: number;
  readonly rowCount: number;
  readonly virtual: boolean;
  readonly opens: boolean;
  readonly selecting: boolean;
  readonly firstLinkedIndex: number;
  readonly hintId: string;
  readonly tabbableId: string | undefined;
  readonly rowLink: RowLink<TData> | undefined;
  readonly onRowClick: ((row: TData, event: RowClickEvent) => void) | undefined;
};

const ViewContext = React.createContext<View<RowData> | null>(null);

function useView<TData extends RowData = RowData>() {
  const view = React.useContext(ViewContext);

  if (view === null) throw new Error("A part of the table renders outside its DataTable");

  return view as View<TData>;
}

const idsOf = (key: string) => (key === "" ? [] : key.split("\n"));

// Columns declared once keep their identity, so the table does not rebuild them on every render. The checkboxes read
// the selection from a context, so a new selection does not rebuild them either.
function useColumnDefinitions<TData extends RowData>(
  columns: ReadonlyArray<DataTableColumn<TData, string, string>>,
  headers: DataTableHeaders | undefined,
  selectable: boolean,
) {
  const hiddenKey = (headers?.hiddenColumns ?? []).join("\n");
  const pinnedKey = (headers?.pinnedColumns ?? []).join("\n");

  return React.useMemo(() => {
    const all = columns as ReadonlyArray<DataTableColumn<RowData>>;
    const visible = visibleColumns(all, new Set(idsOf(hiddenKey)));
    // A URL that hides every column with a title hides none, as the menu of columns reads it: a table of its untitled
    // columns only (the actions of a row) is no table.
    const kept = hasTitledLeaf(visible) ? visible : all;

    // Pinned columns come first, in the order they were pinned: only a column with a title, outside any group (a
    // group's header spans its columns, which must stay together).
    const pins = idsOf(pinnedKey).flatMap((id) =>
      kept.filter((column) => !isGroup(column) && isTitled(column) && column.id === id),
    );

    const ordered = [...pins, ...kept.filter((column) => !pins.includes(column))].map(definitionOf);

    return {
      definitions: (selectable ? [selectColumn, ...ordered] : ordered) as ReadonlyArray<
        ColumnDefOf<TData>
      >,
      pinned: pins.map((column) => column.id ?? ""),
    };
  }, [columns, hiddenKey, pinnedKey, selectable]);
}

// Computed when the rows or the callbacks change, not on every render (a virtual table renders on every frame of a
// scroll); kept by what they answer, so `canSelect` and `rowLabel` written inline do not make every checkbox render
// again.
function useSelectionRows<TData extends RowData>(
  rows: ReadonlyArray<Row<typeof features, TData>>,
  selection: DataTableSelection<TData> | undefined,
) {
  const selecting = selection !== undefined;
  const canSelect = selection?.canSelect;
  const rowLabel = selection?.rowLabel;

  const { selectableKey, labelsKey } = React.useMemo(
    () => ({
      selectableKey: selecting
        ? rows.flatMap((row) => ((canSelect?.(row.original) ?? true) ? [row.id] : [])).join("\n")
        : "",
      labelsKey:
        selecting && rowLabel !== undefined
          ? JSON.stringify(rows.map((row) => rowLabel(row.original)))
          : "[]",
    }),
    [rows, selecting, canSelect, rowLabel],
  );

  return React.useMemo<ReadonlyArray<RowOfSelection> | null>(() => {
    if (!selecting) return null;
    const selectableIds = new Set(idsOf(selectableKey));
    const names = JSON.parse(labelsKey) as ReadonlyArray<string>;

    return rows.map((row, i) => ({
      value: row.id,
      label: names[i] === "" ? undefined : names[i],
      selectable: selectableIds.has(row.id),
    }));
  }, [rows, selecting, selectableKey, labelsKey]);
}

const sortMessageOf = (
  columns: ReadonlyArray<DataTableColumn<RowData>>,
  sorting: DataTableSorting | undefined,
) => {
  const title = sorting === undefined ? undefined : titleOf(columns, sorting.column);

  if (sorting === undefined || title === undefined) return "";

  return `Sorted by ${title}, ${ariaSort[sorting.direction]}`;
};

// Most screen readers say nothing when `aria-sort` changes: the table says the new sorting itself.
function useSortAnnouncement(
  columns: ReadonlyArray<DataTableColumn<RowData>>,
  sorting: DataTableSorting | undefined,
) {
  const sortingKey = sorting === undefined ? "" : `${sorting.column}:${sorting.direction}`;
  const [lastSortingKey, setLastSortingKey] = React.useState(sortingKey);
  const [message, setMessage] = React.useState("");

  if (lastSortingKey !== sortingKey) {
    setLastSortingKey(sortingKey);
    setMessage(sortMessageOf(columns, sorting));
  }

  return message;
}

const useRowVirtualizer = (
  virtual: { readonly rowHeight: number; readonly overscan?: number } | undefined,
  rowCount: number,
  viewport: React.RefObject<HTMLDivElement | null>,
  headerHeight: number,
) =>
  // oxlint-disable-next-line react/incompatible-library -- the hooks that read the virtualizer opt out of the compiler
  useVirtualizer({
    enabled: virtual !== undefined,
    count: rowCount,
    getScrollElement: () => viewport.current,
    estimateSize: () => virtual?.rowHeight ?? 0,
    // The sticky header covers the top of the viewport: a row scrolled to lands below it.
    scrollPaddingStart: headerHeight,
    overscan: virtual?.overscan ?? 8,
  });

// Clickable rows are one stop of the Tab key, at the row last focused (the first at the start). In a virtual table,
// only the rows in view are rendered: the first of them when the last focused is not. Not the first rendered, which
// may be one of the rows kept above the view: the first in view, so Tab does not scroll the table back.
const firstInViewOf = (
  items: ReadonlyArray<{ index: number; start: number }>,
  scrollOffset: number | null,
) => items.find((item) => item.start >= (scrollOffset ?? 0)) ?? items[0];

const tabbableRowOf = (
  rows: ReadonlyArray<{ id: string }>,
  items: ReadonlyArray<{ index: number; start: number }>,
  scrollOffset: number | null,
  activeRow: string | null,
  isVirtual: boolean,
) => {
  const rendered = isVirtual ? items.flatMap((item) => rows[item.index] ?? []) : rows;

  if (activeRow !== null && rendered.some((row) => row.id === activeRow)) return activeRow;

  return rows[isVirtual ? (firstInViewOf(items, scrollOffset)?.index ?? 0) : 0]?.id;
};

const hasStickyEndColumn = <TData extends RowData>(table: ReactTable<typeof features, TData>) =>
  table
    .getAllLeafColumns()
    .some((column) => layoutOf(column.columnDef, column.id).sticky === "end");

const heldProps = (pin: Pin | undefined, sticky: ReturnType<typeof layoutOf>["sticky"]) => ({
  pinEdge: pin?.edge ?? false,
  sticky: pin === undefined ? sticky : ("start" as const),
});

const ariaSortOf = (sorting: DataTableSorting | undefined, id: string) =>
  sorting?.column === id ? ariaSort[sorting.direction] : undefined;

const widthProps = (size: number | undefined, spansColumns: boolean) =>
  size !== undefined && !spansColumns
    ? { className: "w-(--column-size) min-w-(--column-size)" }
    : {};

// What the parts of the table read from it: the row last focused, the Tab stop, and the way a row opens.
function useRowsView<TData extends RowData>({
  table,
  headers,
  pins,
  viewport,
  headerHeight,
  virtualizer,
  selectable,
  rowLink,
  onRowClick,
}: {
  table: ReactTable<typeof features, TData>;
  headers: DataTableHeaders | undefined;
  pins: View<TData>["pins"];
  viewport: React.RefObject<HTMLDivElement | null>;
  headerHeight: number;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  selectable: boolean;
  rowLink: RowLink<TData> | undefined;
  onRowClick: View<TData>["onRowClick"];
}): View<TData> {
  // The virtualizer changes inside and keeps its identity: memoized by it, its rows would never change. The table is
  // a new object whenever its options or its state change.
  "use no memo";

  const rows = table.getRowModel().rows;
  const isVirtual = virtualizer.options.enabled;

  const focus = useRowFocus({
    viewport,
    virtualizer,
    rowCount: rows.length,
    rowsKey: headers?.rowsKey ?? rows[0]?.id,
  });

  return {
    table,
    headers,
    pins,
    focus,
    viewport,
    headerHeight,
    headerRowCount: table.getHeaderGroups().length,
    rowCount: rows.length,
    virtual: isVirtual,
    opens: onRowClick !== undefined || rowLink !== undefined,
    selecting: selectable,
    // The checkbox column comes first, and holds no link.
    firstLinkedIndex: selectable ? 1 : 0,
    hintId: React.useId(),
    tabbableId: tabbableRowOf(
      rows,
      virtualizer.getVirtualItems(),
      virtualizer.scrollOffset,
      focus.activeRow,
      isVirtual,
    ),
    rowLink,
    onRowClick,
  };
}

function HeaderContent({ header }: { header: Header<typeof features, RowData, unknown> }) {
  const { table, headers } = useView();

  return isTitled(header.column.columnDef) ? (
    <TitledHeader column={header.column.columnDef} table={headers} />
  ) : (
    <table.FlexRender header={header} />
  );
}

function HeaderCell({ header }: { header: Header<typeof features, RowData, unknown> }) {
  const { headers, pins } = useView();
  const spansColumns = header.column.columns.length > 0;
  const layout = layoutOf(header.column.columnDef, header.column.id);
  const pin = spansColumns ? undefined : pins.of(header.column.id);
  const sorting = headers?.sorting;

  return (
    <TableHead
      {...(pin !== undefined && { ref: pins.head(header.column.id) })}
      {...heldProps(pin, layout.sticky)}
      colSpan={header.colSpan}
      rowSpan={header.rowSpan > 1 ? header.rowSpan : undefined}
      scope={spansColumns ? "colgroup" : "col"}
      // Chromium exposes a header of scope `colgroup` as a cell.
      role="columnheader"
      aria-sort={ariaSortOf(sorting, header.column.id)}
      shrink={layout.shrink}
      align={layout.align}
      spans={spansColumns}
      style={
        {
          "--column-size": layout.size === undefined ? "auto" : `${layout.size}px`,
          "--pin-start": `${pin?.start ?? 0}px`,
        } as React.CSSProperties
      }
      // A width given to a column holds from one page to the next, at least.
      {...widthProps(layout.size, spansColumns)}
    >
      <HeaderContent header={header} />
    </TableHead>
  );
}

function HeaderRows() {
  const { table, virtual } = useView();

  return (
    <>
      {table.getHeaderGroups().map((group, depth) => (
        <TableRow key={group.id} aria-rowindex={virtual ? depth + 1 : undefined}>
          {/* A column shallower than the others spans the rows above it, from its topmost header down. */}
          {group.headers
            .filter((header) => header.rowSpan > 0)
            .map((header) => (
              <HeaderCell key={header.id} header={header} />
            ))}
        </TableRow>
      ))}
    </>
  );
}

function RowLinkOverlay<TData extends RowData>({
  link,
  hidden,
}: {
  link: ReturnType<RowLink<TData>>;
  hidden: boolean;
}) {
  return React.cloneElement(link, {
    "data-slot": rowLinkSlot,
    className: "absolute inset-0 z-1",
    tabIndex: -1,
    // Read once per row, in its first cell: the same link in every cell would be heard in every cell.
    ...(hidden && { "aria-hidden": true }),
  });
}

function DataTableCell<TData extends RowData>({
  cell,
  row,
  cellIndex,
}: {
  cell: Cell<typeof features, TData, unknown>;
  row: Row<typeof features, TData>;
  cellIndex: number;
}) {
  const { table, rowLink, pins, firstLinkedIndex } = useView<TData>();
  const layout = layoutOf(cell.column.columnDef, cell.column.id);
  const pin = pins.of(cell.column.id);
  const held = heldProps(pin, layout.sticky);
  const linked = rowLink !== undefined && cell.column.id !== selectColumnId;

  return (
    <TableCell
      {...held}
      // The link covers the cell: a sticky cell already holds it, any other one is made to. `isolate` keeps the
      // link of a cell scrolling under the pinned ones below them, and their checkboxes.
      {...(linked && {
        className: cn(held.sticky === false && "relative isolate", controlsAboveRowLink),
      })}
      {...(pin !== undefined && {
        style: { "--pin-start": `${pin.start}px` } as React.CSSProperties,
      })}
      shrink={layout.shrink}
      align={layout.align}
      // The cell of the checkbox selects, it does not open the row.
      {...(cell.column.id === selectColumnId && { "data-row-click-ignore": true })}
    >
      <table.FlexRender cell={cell} />
      {linked && (
        <RowLinkOverlay link={rowLink(row.original)} hidden={cellIndex !== firstLinkedIndex} />
      )}
    </TableCell>
  );
}

// Enter follows the link of a row that is one, and opens any other.
const openRowWith =
  <TData extends RowData>({ rowLink, onRowClick }: View<TData>, row: Row<typeof features, TData>) =>
  (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (rowLink === undefined) onRowClick?.(row.original, event);
    else
      event.currentTarget.querySelector<HTMLAnchorElement>(`a[data-slot=${rowLinkSlot}]`)?.click();
  };

const clickProps = <TData extends RowData>(
  onRowClick: (row: TData, event: RowClickEvent) => void,
  row: TData,
) => ({
  onClick: (event: React.MouseEvent<HTMLTableRowElement>) => {
    if (isOwnClick(event)) onRowClick(row, event);
  },
  // The middle button clicks through `auxclick`: it opens the row too, the event telling where (a new tab).
  onAuxClick: (event: React.MouseEvent<HTMLTableRowElement>) => {
    if (event.button === 1 && isOwnClick(event)) onRowClick(row, event);
  },
});

const openRowProps = <TData extends RowData>(
  view: View<TData>,
  row: Row<typeof features, TData>,
  index: number,
) => {
  const { focus, hintId, onRowClick, rowLink, tabbableId } = view;
  const tabbable = row.id === tabbableId;

  return {
    tabIndex: tabbable ? 0 : -1,
    // Said when the focus enters the rows, not again on every row it moves to.
    "aria-describedby": tabbable ? hintId : undefined,
    onFocus: (event: React.FocusEvent<HTMLTableRowElement>) => {
      if (event.target === event.currentTarget) focus.setActiveRow(row.id);
    },
    ...(onRowClick !== undefined && rowLink === undefined && clickProps(onRowClick, row.original)),
    onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) =>
      onRowKeyDown(event, {
        index,
        rowCount: view.rowCount,
        viewport: view.viewport,
        headerHeight: view.headerHeight,
        selecting: view.selecting,
        focusRow: focus.focusRow,
        open: openRowWith(view, row),
      }),
  };
};

function DataTableRow<TData extends RowData>({
  row,
  index,
}: {
  row: Row<typeof features, TData>;
  index: number;
}) {
  const view = useView<TData>();
  const { focus, headerRowCount, opens, selecting, virtual } = view;

  return (
    <SelectableRow
      rowId={selecting ? row.id : undefined}
      data-row-index={index}
      interactive={opens}
      {...(!virtual && { ref: focus.keepRowFocus })}
      {...(opens && openRowProps(view, row, index))}
      {...(virtual && {
        "data-index": index,
        ref: focus.measureRow,
        // The header rows come first, and `aria-rowindex` starts at 1.
        "aria-rowindex": headerRowCount + index + 1,
      })}
    >
      {row.getAllCells().map((cell, cellIndex) => (
        <DataTableCell key={cell.id} cell={cell} row={row} cellIndex={cellIndex} />
      ))}
    </SelectableRow>
  );
}

// Two empty rows keep the height of the rows out of view, so the scrollbar stays true.
function RowSpacer({ height }: { height: number }) {
  return (
    <tr
      aria-hidden="true"
      style={{ "--row-height": `${height}px` } as React.CSSProperties}
      className="h-(--row-height)"
    />
  );
}

function TableRows<TData extends RowData>({
  rows,
  items,
  totalSize,
  columnCount,
  empty,
  keepFocusInTable,
}: {
  rows: ReadonlyArray<Row<typeof features, TData>>;
  items: ReadonlyArray<VirtualItem>;
  totalSize: number;
  columnCount: number;
  empty: ReactNode;
  keepFocusInTable: (node: HTMLDivElement | null) => () => void;
}) {
  const { virtual } = useView();

  if (rows.length === 0)
    return (
      <TableRow hoverable={false}>
        <TableCell colSpan={columnCount}>
          {/* As wide as the viewport and held at its start: a table wider than the screen keeps it in view. */}
          <div
            ref={keepFocusInTable}
            className="sticky start-3 w-(--empty-width) max-w-full wrap-anywhere whitespace-normal"
          >
            {empty}
          </div>
        </TableCell>
      </TableRow>
    );

  if (!virtual)
    return rows.map((row, index) => <DataTableRow key={row.id} row={row} index={index} />);

  return (
    <>
      <RowSpacer height={items[0]?.start ?? 0} />
      {items.map((item) => {
        const row = rows[item.index];

        return row === undefined ? null : (
          <DataTableRow key={row.id} row={row} index={item.index} />
        );
      })}
      <RowSpacer height={totalSize - (items.at(-1)?.end ?? 0)} />
    </>
  );
}

/** The scroll area of the table: its scrollbars, and the shades that say there are columns past an edge. */
function TableScroll({
  label,
  viewport,
  size,
  heldEdges,
  children,
}: {
  label: string | undefined;
  viewport: React.RefObject<HTMLDivElement | null>;
  size: { width: number; height: number };
  heldEdges: { start: number; end: number };
  children: ReactNode;
}) {
  return (
    // The table's own variables sit here, not on its root, whose `style` is the app's (a height).
    <ScrollAreaPrimitive
      style={
        {
          "--header-height": `${size.height}px`,
          "--held-start": `${heldEdges.start}px`,
          "--held-end": `${heldEdges.end}px`,
          // The viewport less the padding of a cell; `auto` until measured (the server knows no width), so the
          // empty slot spans its cell meanwhile.
          "--empty-width": size.width > 0 ? `calc(${size.width}px - var(--spacing) * 6)` : "auto",
        } as React.CSSProperties
      }
      className="group/scroll relative flex min-h-0 flex-1 flex-col"
      // Named for an agent, which lists the scroll area among the components of the page.
      {...(label !== undefined && { "aria-label": `Scrolling of ${label}` })}
    >
      <ScrollAreaViewport
        ref={viewport}
        // Focusable by code whatever it holds: the focus of a row or an empty slot that goes lands here.
        tabIndex={-1}
        // The horizontal scrollbar overlays the rows: its height (h-2.5) is kept free below the last one. No
        // rubber band at the edges: it would drag the sticky header off the rows, and a horizontal one would swipe
        // back in history. A table with nothing to scroll still lets the page scroll under the wheel.
        className="size-full scroll-pt-(--header-height) overscroll-x-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-data-overflow-x/scroll:pb-2.5 data-overflow-y:overscroll-y-none"
      >
        {/* Watched for its size: rows that come or go (a search, a page) update the scrollbars and the shades. */}
        <ScrollAreaContent>{children}</ScrollAreaContent>
      </ScrollAreaViewport>
      {/* The track starts below the header, a padding the thumb is sized without. */}
      <ScrollBar autoHide className="z-20 pt-(--header-height)" />
      {/* A scrollbar that shows on hover only says nothing of the columns past the edge: a shade does. */}
      <div
        aria-hidden="true"
        data-slot="data-table-overflow-start"
        className="pointer-events-none absolute inset-y-0 start-(--held-start) z-20 w-6 from-shade to-transparent opacity-0 transition-opacity group-[[data-overflow-x]:not([data-at-x-start])]/scroll:opacity-100 motion-reduce:transition-none ltr:bg-linear-to-r rtl:bg-linear-to-l"
      />
      <div
        aria-hidden="true"
        data-slot="data-table-overflow-end"
        className="pointer-events-none absolute inset-y-0 end-(--held-end) z-20 w-6 from-shade to-transparent opacity-0 transition-opacity group-[[data-overflow-x]:not([data-at-x-end])]/scroll:opacity-100 motion-reduce:transition-none ltr:bg-linear-to-l rtl:bg-linear-to-r"
      />
      {/* The track runs along the columns that scroll only, between those held at each end: a padding the scroll area
            counts when it sizes the thumb. */}
      <ScrollBar orientation="horizontal" className="z-20 ps-(--held-start) pe-(--held-end)" />
      <ScrollAreaCorner />
    </ScrollAreaPrimitive>
  );
}

/** One region per message: a region is read whole when it changes, so a sorting would be read again with every empty result after it. */
function LiveRegions({ sorting, empty }: { sorting: string; empty: string }) {
  return (
    <>
      <span role="status" className="sr-only">
        {sorting}
      </span>
      <span role="status" className="sr-only">
        {empty}
      </span>
    </>
  );
}

function TableFooter({ children }: { children: ReactNode }) {
  if (children === undefined) return null;

  return (
    <div
      data-slot="data-table-footer"
      className="@container border-t bg-muted/50 px-3 py-2 text-sm"
    >
      {children}
    </div>
  );
}

const scoped = (prefix: string, label: string | undefined) =>
  label === undefined ? undefined : `${prefix} ${label}`;

const rootSelection = <TData extends RowData>(
  selection: DataTableSelection<TData> | undefined,
  rows: ReadonlyArray<RowOfSelection> | null,
  allRows: boolean,
) =>
  selection !== undefined && rows !== null
    ? {
        selection: {
          selected: selection.selected,
          onSelectedChange: selection.onSelectedChange,
          rows,
          allRows,
        },
      }
    : {};

function TableGrid({
  label,
  head,
  busy,
  children,
}: {
  label: string | undefined;
  head: React.RefObject<HTMLTableSectionElement | null>;
  busy: boolean;
  children: ReactNode;
}) {
  const { headerRowCount, rowCount, virtual } = useView();

  return (
    <Table
      aria-label={label}
      // Assistive tech counts the rows in the DOM: with only those in view there, it is told how many there are.
      // With no row, the empty slot is a row of its own: the count is left to the DOM.
      aria-rowcount={virtual && rowCount > 0 ? headerRowCount + rowCount : undefined}
    >
      {/* Sticky as a whole: its rows, as many as the groups of columns are deep, stay stacked. */}
      <TableHeader ref={head} sticky>
        <HeaderRows />
      </TableHeader>
      <TableBody aria-busy={busy || undefined}>{children}</TableBody>
    </Table>
  );
}

function RowsHint({ id, selecting }: { id: string; selecting: boolean }) {
  return (
    <span id={id} hidden>
      {selecting
        ? "Enter opens a row, Space selects it; the arrow keys move between rows."
        : "Enter opens a row; the arrow keys move between rows."}
    </span>
  );
}

// The hooks of the table, in the order each needs the one before: its model, the sizes it measures, and the messages
// it says.
function useGrid<TData extends RowData>({
  headers,
  columns,
  data,
  getRowId,
  selection,
  virtual,
  rowLink,
  onRowClick,
  empty,
}: {
  headers: DataTableHeaders | undefined;
  columns: ReadonlyArray<DataTableColumn<TData, string, string>>;
  data: ReadonlyArray<TData>;
  getRowId: ((row: TData) => string) | undefined;
  selection: DataTableSelection<TData> | undefined;
  virtual: { readonly rowHeight: number; readonly overscan?: number } | undefined;
  rowLink: RowLink<TData> | undefined;
  onRowClick: View<TData>["onRowClick"];
  empty: ReactNode;
}) {
  // The virtualizer changes inside and keeps its identity: memoized by it, its rows would never change. The table is
  // a new object whenever its options or its state change.
  "use no memo";

  const selectable = selection !== undefined;
  const { definitions, pinned } = useColumnDefinitions(columns, headers, selectable);

  const table = useTable({
    features,
    columns: definitions,
    data,
    ...(getRowId && { getRowId }),
  });

  const rows = table.getRowModel().rows;
  const selectionRows = useSelectionRows(rows, selection);
  const hasStickyEnd = hasStickyEndColumn(table);
  const viewport = React.useRef<HTMLDivElement>(null);
  const head = React.useRef<HTMLTableSectionElement>(null);
  const size = useSize(viewport, head);
  const { pins, heldEdges } = usePinLayout({ pinned, selectable, head, hasStickyEnd });
  const virtualizer = useRowVirtualizer(virtual, rows.length, viewport, size.height);

  const sortMessage = useSortAnnouncement(
    columns as ReadonlyArray<DataTableColumn<RowData>>,
    headers?.sorting,
  );

  const emptySlot = useEmptySlot({ viewport, rowCount: rows.length, empty });

  const view = useRowsView<TData>({
    table,
    headers,
    pins,
    viewport,
    headerHeight: size.height,
    virtualizer,
    selectable,
    rowLink,
    onRowClick,
  });

  return {
    view,
    rows,
    selectionRows,
    hasStickyEnd,
    viewport,
    head,
    size,
    heldEdges,
    items: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    columnCount: table.getAllLeafColumns().length,
    keepFocusInTable: emptySlot.keepFocusInTable,
    sortMessage,
    emptyMessage: emptySlot.message,
  };
}

export function DataTable<
  TData extends RowData,
  Sort extends string = string,
  FilterKey extends string = string,
>({
  table: headers,
  columns,
  data,
  empty,
  footer,
  getRowId,
  label,
  virtual,
  onRowClick,
  rowLink,
  selection,
  busy = false,
  className,
  ...props
}: {
  /** What `useDataTable` answers: the headers sort and filter through it, and tell assistive tech the sorting. */
  table?: DataTableHeaders<Sort, FilterKey>;
  /** Declared outside the component, or memoized: new columns on every render rebuild the table every time. */
  columns: ReadonlyArray<DataTableColumn<TData, NoInfer<Sort>, NoInfer<FilterKey>>>;
  data: ReadonlyArray<TData>;
  /** What the body shows with no row: `DataTableEmptyState`, `DataTableLoadingState`, `DataTableErrorState`. */
  empty?: ReactNode;
  footer?: ReactNode;
  /** The accessible name of the table, which tells it from another one on the page. */
  label?: string;
  /**
   * Renders only the rows in view, and a few around them, for a table of thousands of rows that does not page. Its
   * parent must bound its height. `rowHeight` is the height, in pixels, a row is taken to have until it is measured.
   */
  virtual?: { readonly rowHeight: number; readonly overscan?: number };
  /**
   * Makes each row open something (a dialog, a page) on a click anywhere in it, but on its own buttons, links and
   * menus, which keep their action. The rows themselves are one stop of the Tab key, their own controls keep theirs:
   * the arrow keys move between rows, and Enter opens one. The event tells a click with a modifier, to open a new tab.
   */
  onRowClick?: (row: TData, event: RowClickEvent) => void;
  /**
   * Makes each row a link, in place of `onRowClick`: the element it answers, such as a router's `<Link>`, covers every
   * cell but the checkbox's, so a click anywhere in the row follows it as a link does (a new tab with a modifier or
   * the middle button, from its menu). Its accessible name names the row: only the first cell's is read, the others
   * are hidden from assistive tech. The rows take the focus and the arrow keys as with `onRowClick`; Enter follows the
   * link. The text of a row cannot be selected.
   */
  rowLink?: (row: TData) => React.ReactElement<{
    className?: string;
    tabIndex?: number;
    "aria-hidden"?: boolean;
    "data-slot"?: string;
  }>;
  /** True while other rows load: the rows shown fade, and assistive tech hears the table is busy. */
  busy?: boolean;
} & (
  | {
      /**
       * Adds a checkbox at the start of each row, and one in the header that selects them all:
       * `useDataTableSelection` answers it. Rows are selected by id: `getRowId` says which.
       */
      selection: DataTableSelection<TData>;
      getRowId: (row: TData) => string;
    }
  | {
      selection?: undefined;
      /**
       * Keys the rows: by default a row is its index, the same from one page to the next. Without it, nor
       * `useDataTable`'s `table`, the table cannot tell other rows from the same, and keeps their scroll.
       */
      getRowId?: (row: TData) => string;
    }
) &
  Omit<ComponentProps<"div">, "children">) {
  const grid = useGrid({
    headers: headers as DataTableHeaders | undefined,
    columns,
    data,
    getRowId,
    selection,
    virtual,
    rowLink,
    onRowClick,
    empty,
  });

  const { view, rows } = grid;

  // As tall as its rows, up to the height its parent gives it (a column of flex with a height, the table not told to
  // grow): past it, the rows scroll in its own viewport. To fill the height whatever the rows, give it `flex-1`. The
  // header stays in the table to keep its columns, its cells sticky (a table does not keep a sticky section above its
  // rows); the footer, one cell wide, sits below the scroll area, so the scrollbar runs along the rows only.
  return (
    <ViewContext value={view as View<RowData>}>
      <TableRoot
        // A column held at the end draws its own edge: the shade of the end would darken it.
        data-sticky-end={grid.hasStickyEnd || undefined}
        label={scoped("Selection of", label)}
        className={cn(
          "group/table flex min-h-0 flex-col overflow-hidden rounded-xl border bg-surface",
          className,
        )}
        {...props}
        {...rootSelection(selection, grid.selectionRows, view.virtual)}
      >
        <TableScroll
          label={label}
          viewport={grid.viewport}
          size={grid.size}
          heldEdges={grid.heldEdges}
        >
          <TableGrid label={label} head={grid.head} busy={busy}>
            <TableRows
              rows={rows}
              items={grid.items}
              totalSize={grid.totalSize}
              columnCount={grid.columnCount}
              empty={empty}
              keepFocusInTable={grid.keepFocusInTable}
            />
          </TableGrid>
        </TableScroll>
        {view.opens && <RowsHint id={view.hintId} selecting={view.selecting} />}
        <LiveRegions sorting={grid.sortMessage} empty={grid.emptyMessage} />
        <TableFooter>{footer}</TableFooter>
      </TableRoot>
    </ViewContext>
  );
}
