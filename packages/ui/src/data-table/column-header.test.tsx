import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { DataTable, type DataTableColumn, type DataTableHeaders } from "@quack/ui/data-table";

import { render } from "vitest-browser-react";
import { elementOf, headerButton } from "@quack/ui/testing/dom";

type Row = { readonly email: string; readonly tags: string; readonly amount: number };

const data: ReadonlyArray<Row> = [{ email: "ada@example.com", tags: "vip", amount: 3 }];

/** A table whose headers sort by `sorted`, and open their filter through `openFilter`. */
const headers = ({
  sorted,
  onSort = vi.fn(),
  openFilter = vi.fn(),
}: {
  sorted: "asc" | "desc" | undefined;
  onSort?: (column: string, direction: "asc" | "desc") => void;
  openFilter?: (key: string) => void;
}): DataTableHeaders => ({
  sorting: { column: "email", direction: sorted ?? "asc" },
  sortHeader: (column) => ({
    sorted: column === "email" ? sorted : undefined,
    onSort: (direction) => onSort(column, direction),
  }),
  openFilter,
});

const renderTable = (table: DataTableHeaders, columns: ReadonlyArray<DataTableColumn<Row>>) =>
  render(
    <>
      <DataTable table={table} columns={columns} data={data} />
      <input id="filter" aria-label="Filter" />
    </>,
  );

const email: DataTableColumn<Row> = {
  id: "email",
  accessorKey: "email",
  title: "Email",
  sortable: true,
  filter: "email",
};

const setup = async () => {
  const onSort = vi.fn();

  const openFilter = vi.fn(() =>
    elementOf(HTMLInputElement, document.getElementById("filter")).focus(),
  );

  await renderTable(headers({ sorted: "asc", onSort, openFilter }), [email]);

  return { onSort, openFilter, trigger: headerButton("Email") };
};

describe("DataTable column header", () => {
  it("sorts the other way, and gives the focus back to the header", async () => {
    const { onSort, openFilter, trigger } = await setup();

    await trigger.click();
    await page.getByRole("menuitemradio", { name: "Descending" }).click();

    expect(onSort).toHaveBeenCalledWith("email", "desc");
    await expect.element(trigger).toHaveFocus();
    expect(openFilter).not.toHaveBeenCalled();
  });

  it("asks for the filter once the menu has closed, and leaves the focus to it", async () => {
    const { openFilter, trigger } = await setup();

    await trigger.click();
    await page.getByRole("menuitem", { name: "Filter" }).click();

    await expect.poll(() => openFilter).toHaveBeenCalledExactlyOnceWith("email");
    expect(page.getByRole("menu").elements()).toHaveLength(0);
    await expect.element(page.getByRole("textbox", { name: "Filter" })).toHaveFocus();
  });

  it("asks for no filter when the menu closes on Escape after a filter", async () => {
    const { openFilter, trigger } = await setup();
    await trigger.click();
    await page.getByRole("menuitem", { name: "Filter" }).click();
    await expect.poll(() => openFilter).toHaveBeenCalledOnce();

    await trigger.click();
    await userEvent.keyboard("{Escape}");

    await expect.element(trigger).toHaveFocus();
    expect(openFilter).toHaveBeenCalledOnce();
  });

  it("opens the filter at once from a column that does not sort, with no menu", async () => {
    const openFilter = vi.fn();
    await renderTable(headers({ sorted: undefined, openFilter }), [
      { id: "tags", accessorKey: "tags", title: "Tags", filter: "tags" },
    ]);

    const button = headerButton("Tags");
    await expect.element(button).toHaveAccessibleDescription("Filter");
    await button.click();

    expect(openFilter).toHaveBeenCalledExactlyOnceWith("tags");
    expect(page.getByRole("menu").elements()).toHaveLength(0);
  });

  it("shows how a column sorts: up, down, or both ways while unsorted", async () => {
    const columns = [
      { id: "email", accessorKey: "email", title: "Email", sortable: true },
    ] as const;

    const screen = await renderTable(headers({ sorted: undefined }), columns);

    const icon = () => elementOf(SVGElement, headerButton("Email").element().querySelector("svg"));

    expect(icon()).toHaveClass("lucide-chevrons-up-down");
    await screen.rerender(
      <DataTable table={headers({ sorted: "asc" })} columns={columns} data={data} />,
    );
    expect(icon()).toHaveClass("lucide-arrow-up");
    await screen.rerender(
      <DataTable table={headers({ sorted: "desc" })} columns={columns} data={data} />,
    );
    expect(icon()).toHaveClass("lucide-arrow-down");
  });

  it("puts its icon before the title in a column set at the end", async () => {
    await renderTable(headers({ sorted: "asc" }), [
      { id: "tags", accessorKey: "tags", title: "Amount", align: "end", filter: "tags" },
      { id: "email", accessorKey: "email", title: "Total", align: "end", sortable: true },
    ]);

    for (const name of ["Amount", "Total"]) {
      const html = headerButton(name).element().innerHTML;
      expect(html.indexOf("<svg")).toBeLessThan(html.indexOf(name));
      expect(html.indexOf("<svg")).toBeGreaterThanOrEqual(0);
    }
  });
});
