import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { ScrollBar } from "@quack/ui/components/scroll-area";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@quack/ui/components/table";
import { type ColumnDef, type RowData, tableFeatures, useTable } from "@tanstack/react-table";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

const features = tableFeatures({});

export type SortDirection = "asc" | "desc";

const ariaSort = { asc: "ascending", desc: "descending" } as const;

export type DataTableColumn<TData extends RowData> = ColumnDef<
  typeof features,
  TData,
  // oxlint-disable-next-line typescript/no-explicit-any -- the columns of one table hold values of different types
  any
>;

export function DataTable<TData extends RowData>({
  columns,
  data,
  empty,
  footer,
  getRowId,
  sorting,
  className,
  ...props
}: {
  columns: ReadonlyArray<DataTableColumn<TData>>;
  data: ReadonlyArray<TData>;
  empty?: ReactNode;
  footer?: ReactNode;
  /** Keys the rows: by default a row is its index, the same from one page to the next. */
  getRowId?: (row: TData) => string;
  /** The column the data is sorted by, which its header tells assistive tech. */
  sorting?: { readonly column: string; readonly direction: SortDirection };
} & Omit<ComponentProps<"div">, "children">) {
  const table = useTable({ features, columns, data, ...(getRowId && { getRowId }) });
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  // Scrolls in its own viewport once its parent bounds its height. The header stays in the table to keep its
  // columns, its cells sticky (a table does not keep a sticky section above its rows); the footer, one cell wide,
  // sits below the scroll area, so the scrollbar runs along the rows only.
  return (
    <div
      data-slot="data-table"
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Root className="relative flex min-h-0 flex-col">
        <ScrollAreaPrimitive.Viewport
          data-slot="data-table-viewport"
          className="size-full overscroll-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <table data-slot="table" className="w-full caption-bottom text-sm">
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        sorting?.column === header.column.id
                          ? ariaSort[sorting.direction]
                          : undefined
                      }
                      className="sticky top-0 z-10 h-10 bg-background px-3 shadow-[inset_0_-1px_0_var(--color-border)]"
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="px-3 whitespace-normal">
                    {empty}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="px-3">
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </ScrollAreaPrimitive.Viewport>
        {/* The track starts below the header (h-10), a padding that Base UI counts when it sizes the thumb. */}
        <ScrollBar className="pt-10 opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100" />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
      {footer !== undefined && (
        <div
          data-slot="data-table-footer"
          className="@container border-t bg-muted/50 px-3 py-2 text-sm"
        >
          {footer}
        </div>
      )}
    </div>
  );
}
