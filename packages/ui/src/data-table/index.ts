/**
 * A table of rows a screen pages, sorts, searches, filters, and selects. `useDataTable` keeps its state in a store the
 * app provides (memory, or the URL through a router) and answers what the parts take: the screen composes `DataTable`
 * with the toolbar, the pagination, the column visibility, the states, and the selection bar it needs.
 */
export {
  DataTable,
  type DataTableColumn,
  type DataTableColumnFor,
  type DataTableHeaders,
} from "#/data-table/lib/data-table.tsx";

export {
  type DataTableController,
  type DataTableFiltersOf,
  useDataTable,
} from "#/data-table/lib/use-data-table.ts";

export { useMemoryDataTableStore } from "#/data-table/lib/use-memory-data-table-store.ts";

export type {
  DataTableBaseState,
  DataTableFilterKey,
  DataTableSorting,
  DataTableStateValue,
  DataTableStore,
  DataTableValue,
} from "#/data-table/lib/state.ts";

export { DataTableToolbar } from "#/data-table/lib/toolbar.tsx";

export { DataTablePagination } from "#/data-table/lib/pagination.tsx";

export { DataTableColumnVisibility } from "#/data-table/lib/column-visibility.tsx";

export {
  DataTableEmptyState,
  DataTableErrorState,
  DataTableLoadingState,
  DataTableLoadMore,
} from "#/data-table/lib/states.tsx";

export {
  type DataTableSelection,
  DataTableSelectionBar,
  useDataTableSelection,
} from "#/data-table/lib/selection.tsx";

export {
  type DataTableFilter,
  type DataTableFilterEditorProps,
  DataTableFilterPopover,
} from "#/data-table/lib/filters/filter.tsx";

export type {
  DataTableFilterOption,
  DataTableOptionsStatus,
} from "#/data-table/lib/filters/options.tsx";

export { booleanFilter } from "#/data-table/lib/filters/boolean-filter.tsx";

export { selectFilter } from "#/data-table/lib/filters/select-filter.tsx";

export { multiSelectFilter } from "#/data-table/lib/filters/multi-select-filter.tsx";
