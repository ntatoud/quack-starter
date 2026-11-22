import { XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import {
  RowSelectionBox,
  RowSelectionRow,
  SelectionContext,
} from "@quack/ui/components/data-table/row-selection-parts";
import {
  SelectionBarBar,
  SelectionBarRoot,
  SelectionBarStatus,
} from "@quack/ui/components/data-table/selection-bar-parts";
import { TableRow } from "@quack/ui/components/table";

/**
 * The rows selected in a table, by id (`getRowId`): what `DataTable` takes as `selection`. The selection is the
 * app's: it holds ids, so it lasts across pages, a sort or a filter, until the app clears it.
 */
export type DataTableSelection<TData> = {
  readonly selected: ReadonlySet<string>;
  readonly onSelectedChange: (selected: ReadonlySet<string>) => void;
  /** Names the checkbox of a row for assistive tech: "Select Ada Lovelace". Defaults to "Select row". */
  readonly rowLabel?: (row: TData) => string;
  /** Whether a row can be selected. Defaults to every row. */
  readonly canSelect?: (row: TData) => boolean;
};

// `stored` itself while every id stays among the rows kept, so the selection keeps its identity.
function narrow(stored: ReadonlySet<string>, matching: Iterable<string> | undefined) {
  if (matching === undefined) return stored;

  const kept = new Set(matching);

  return [...stored].every((id) => kept.has(id))
    ? stored
    : new Set([...stored].filter((id) => kept.has(id)));
}

/**
 * The selection of a table, in React state: pass it whole to `DataTable` as `selection`.
 *
 * A search or a filter narrows the selection to the rows it keeps when the app knows them all: pass their ids as
 * `matching` (a filter in memory, or an API that answers the ids that match). When it only knows the page shown, pass
 * `resetOn: table.filtersKey` instead, and a new search or filter clears the selection. Either way, a bulk action never
 * reaches a row the user no longer sees among the results.
 */
export function useDataTableSelection<TData>(
  options: Pick<DataTableSelection<TData>, "rowLabel" | "canSelect"> & {
    readonly initial?: Iterable<string>;
    /** The ids of every row the search and the filters keep, on every page; `undefined` while they are unknown. */
    readonly matching?: Iterable<string> | undefined;
    /** Clears the selection whenever it changes: `table.filtersKey`. */
    readonly resetOn?: unknown;
  } = {},
) {
  const { initial, matching, resetOn, ...rest } = options;
  const [stored, setStored] = React.useState<ReadonlySet<string>>(() => new Set(initial));
  const [lastReset, setLastReset] = React.useState(resetOn);

  // Adjusted while rendering, as React advises for state that follows a prop: no render shows the stale selection.
  if (!Object.is(lastReset, resetOn)) {
    setLastReset(resetOn);
    setStored(new Set());
  }

  const selected = narrow(stored, matching);

  // Narrowed for good: removing the filter does not bring back rows the user saw leave the selection.
  if (selected !== stored) setStored(selected);

  const { rowLabel, canSelect } = rest;

  // The same object while the selection stays the same: the checkboxes of the table do not render again. `selected`
  // is `stored` but in the render that narrows it, which stores the narrowed set at once.
  return {
    ...(rowLabel !== undefined && { rowLabel }),
    ...(canSelect !== undefined && { canSelect }),
    selected,
    onSelectedChange: setStored,
    /** How many rows are selected. */
    count: selected.size,
    /** The ids selected, in the order they were selected. */
    ids: [...selected],
    isSelected: (id: string) => selected.has(id),
    clear: () => setStored(new Set()),
  };
}

/**
 * A row of the table: with a `rowId`, a row of its selection, which hears Space on it (Shift from the last row
 * pressed); without, a plain row.
 */
export function SelectableRow({
  rowId,
  interactive,
  ...props
}: Omit<React.ComponentProps<typeof TableRow>, "id"> & { rowId?: string | undefined }) {
  if (rowId === undefined) return <TableRow interactive={interactive} {...props} />;

  return (
    <RowSelectionRow
      value={rowId}
      render={<TableRow interactive={interactive} />}
      // The props are a row's: `ComponentProps` allows an explicit `undefined` where a part's props do not.
      {...(props as Omit<React.ComponentProps<typeof RowSelectionRow>, "value">)}
    />
  );
}

const useSelectionModel = () => {
  const model = React.use(SelectionContext);

  if (model === null) throw new Error("A selection cell renders inside a DataTable.");

  return model;
};

/** The checkbox in the header: selects or clears every row of the table that can be selected. */
export function SelectAllCheckbox() {
  const { selectable, selected, allRows, api } = useSelectionModel();
  const count = [...selectable].filter((id) => selected.has(id)).length;
  const all = count > 0 && count === selectable.size;

  return (
    <Checkbox
      aria-label={allRows ? "Select all rows" : "Select all rows shown"}
      checked={count > 0 && !all ? "indeterminate" : all}
      disabled={selectable.size === 0}
      onCheckedChange={() => api.toggleAll()}
    />
  );
}

/**
 * The checkbox of a row. Shift + click selects or clears every row between it and the last one ticked, as a file
 * list does.
 */
export function SelectRowCheckbox({ rowId }: { rowId: string }) {
  const { api, selectable, selected, label } = useSelectionModel();

  return (
    // The change event of a checkbox does not tell whether Shift was held: the box reads it on the press.
    <RowSelectionBox className="flex">
      <Checkbox
        aria-label={label(rowId) ?? "Select row"}
        checked={selected.has(rowId)}
        disabled={!selectable.has(rowId)}
        onCheckedChange={() => api.press(rowId, { range: api.takeShift() })}
      />
    </RowSelectionBox>
  );
}

/**
 * While rows are selected: how many, the actions on them (`children`), and a button that clears the selection. Give the
 * selection to `DataTableToolbar` instead, and the bar takes the toolbar's place while rows are selected: the table
 * does not move. On its own, it shows above the table only while rows are selected, and moves the table down as it
 * shows: prefer the toolbar's. Either way, the count reaches
 * screen readers from the first row ticked, and the focus it held once the selection clears (its clear button, a bulk
 * action) goes to `focusOnEmpty`, by default the "select all" box of the table that follows it.
 */
export function DataTableSelectionBar({
  count,
  onClear,
  focusOnEmpty,
  children,
}: {
  count: number;
  onClear: () => void;
  /** Where the focus goes from the bar once nothing is selected and it hides. */
  focusOnEmpty?: () => HTMLElement | null | undefined;
  /** The actions on the rows selected. */
  children?: React.ReactNode;
}) {
  const label = `${count} selected`;

  return (
    <SelectionBarRoot count={count} onClear={onClear} {...(focusOnEmpty && { focusOnEmpty })}>
      <SelectionBarStatus className="sr-only">{count > 0 ? label : ""}</SelectionBarStatus>
      <SelectionBarBar className="flex min-h-8 flex-wrap items-center gap-1 self-end rounded-md bg-muted p-1 ps-3 text-sm">
        <span aria-hidden className="me-1 font-medium whitespace-nowrap tabular-nums">
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-1">{children}</div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ms-auto"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <XIcon />
        </Button>
      </SelectionBarBar>
    </SelectionBarRoot>
  );
}
