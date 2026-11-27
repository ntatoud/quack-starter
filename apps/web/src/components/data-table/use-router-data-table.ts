import { useRouterDataTableStore } from "#/components/data-table/router-store.ts";
import {
  type DataTableFilterKey,
  type DataTableFiltersOf,
  type DataTableSorting,
  type DataTableStateValue,
  useDataTable,
} from "@quack/ui/data-table";

/**
 * `useDataTable` with its state in the URL: `search` is what the route's `validateSearch` answered
 * (`Route.useSearch()`), and every change of the table navigates. Its pages are links.
 */
export function useRouterDataTable<
  S extends DataTableStateValue,
  const Filters extends DataTableFiltersOf<S> = Record<never, never>,
>({
  search,
  ...options
}: {
  search: S;
  defaultSorting: DataTableSorting<NonNullable<S["orderBy"]>>;
  defaultPageSize?: number;
  filters?: Filters & Record<Exclude<keyof Filters, DataTableFilterKey<S>>, never>;
}) {
  const store = useRouterDataTableStore(search);

  return useDataTable<S, Filters>({ store, ...options });
}
