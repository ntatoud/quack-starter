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
  className,
  ...props
}: {
  columns: ReadonlyArray<DataTableColumn<TData>>;
  data: ReadonlyArray<TData>;
  /** Shown in place of the rows when there is none. */
  empty?: ReactNode;
  footer?: ReactNode;
} & Omit<ComponentProps<"div">, "children">) {
  const table = useTable({ features, columns, data });
  const rows = table.getRowModel().rows;

  return (
    <div
      data-slot="data-table"
      className={cn("overflow-hidden rounded-lg border [&_td]:px-3 [&_th]:px-3", className)}
      {...props}
    >
      <Table>
        <TableHeader>
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
              <TableCell colSpan={columns.length} className="whitespace-normal">
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
          <TableFooter>
            <TableRow>
              <TableCell colSpan={columns.length}>{footer}</TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
