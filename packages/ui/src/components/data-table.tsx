import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@quack/ui/components/table";
import { type ColumnDef, type RowData, tableFeatures, useTable } from "@tanstack/react-table";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

const features = tableFeatures({});

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
  className,
  ...props
}: {
  columns: ReadonlyArray<DataTableColumn<TData>>;
  data: ReadonlyArray<TData>;
  /** Shown in place of the rows when there is none. */
  empty?: ReactNode;
  footer?: ReactNode;
  /** Keys the rows: by default a row is its index, the same from one page to the next. */
  getRowId?: (row: TData) => string;
} & Omit<ComponentProps<"div">, "children">) {
  const table = useTable({
    features,
    columns,
    data,
    ...(getRowId && { getRowId }),
  });
  const rows = table.getRowModel().rows;
  const width = table.getAllLeafColumns().length;

  // Scrolls in its own container once its parent bounds its height, with the header and the footer in view.
  return (
    <div
      data-slot="data-table"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border [&_td]:px-3 [&_th]:px-3 [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:overflow-auto",
        className,
      )}
      {...props}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--color-border)]">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={width} className="whitespace-normal">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
        {footer !== undefined && (
          <TableFooter className="sticky bottom-0 bg-muted shadow-[inset_0_1px_0_var(--color-border)]">
            <TableRow>
              <TableCell colSpan={width} className="whitespace-normal">
                {footer}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
