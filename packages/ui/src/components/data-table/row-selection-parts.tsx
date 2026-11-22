"use client";

import { createParts, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive";
import * as React from "react";

import {
  rowSelection,
  type RowSelectionOptions,
  type RowSelectionRow as RowOfTable,
} from "@quack/ui/lib/data-table/row-selection";

const parts = createParts(rowSelection, { root: "div", row: "tr", box: "span" });

export const RowSelectionRow = parts.Row;
export const RowSelectionBox = parts.Box;

export type Api = ReturnType<typeof rowSelection>["api"];

/** What the checkboxes of a table read: the rows, the selection, and the api that changes it. */
export type SelectionModel = {
  readonly api: Api;
  readonly selected: ReadonlySet<string>;
  /** The rows of the table that can be selected. */
  readonly selectable: ReadonlySet<string>;
  readonly rows: ReadonlyArray<RowOfTable>;
  readonly label: (rowId: string) => string | undefined;
  /** Whether the rows selectable are all the rows, though only some show (a virtual table). */
  readonly allRows: boolean;
};

export const SelectionContext = React.createContext<SelectionModel | null>(null);

/**
 * The root of a table whose rows are selected: it holds the primitive, and shares what its checkboxes read. The
 * selection itself stays the app's (`selected`, `onSelectedChange`): the primitive reports each change and takes the
 * new set back.
 */
export function RowSelectionRoot({
  selected,
  onSelectedChange,
  rows,
  allRows,
  ...props
}: {
  selected: ReadonlySet<string>;
  onSelectedChange: (selected: ReadonlySet<string>) => void;
  rows: ReadonlyArray<RowOfTable>;
  allRows: boolean;
} & Omit<React.ComponentProps<"div">, "defaultValue" | "children"> & {
    children?: React.ReactNode;
  }) {
  const ids = [...selected];

  const options: RowSelectionOptions = {
    selected: ids,
    rows,
    onSelectedChange: (next) => onSelectedChange(new Set(next)),
  };

  const handle = usePrimitive(rowSelection, options);
  const { api } = handle;

  const labelOf = new Map(rows.flatMap((row) => (row.label ? [[row.value, row.label]] : [])));

  const model: SelectionModel = {
    api,
    selected,
    selectable: new Set(rows.flatMap((row) => (row.selectable ? [row.value] : []))),
    rows,
    label: (rowId) => labelOf.get(rowId),
    allRows,
  };

  // `ComponentProps` allows an explicit `undefined` where `PartProps` does not: the props are the table's, a div's.
  const root = usePart(handle, "root", {}, props as PartProps<"div">, "div");

  return <SelectionContext value={model}>{root}</SelectionContext>;
}
