import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { DataTableColumnVisibility } from "@quack/ui/components/data-table/column-visibility";
import { DataTable, type DataTableColumnFor } from "@quack/ui/components/data-table/data-table";
import { useDataTable } from "@quack/ui/hooks/use-data-table";

import { render } from "vitest-browser-react";
import { checkboxBox } from "@quack/ui/testing/dom";

type Product = {
  readonly name: string;
  readonly net: number;
  readonly gross: number;
};

type State = {
  readonly page?: number | undefined;
  readonly orderBy?: "name" | "net" | undefined;
  readonly dir?: "asc" | "desc" | undefined;
  readonly hidden?: ReadonlyArray<string> | undefined;
};

const columns: ReadonlyArray<DataTableColumnFor<Product, State>> = [
  { id: "name", accessorKey: "name", title: "Name", sortable: true },
  {
    id: "prices",
    title: "Price",
    columns: [
      { id: "net", accessorKey: "net", title: "Excl. VAT", sortable: true },
      { id: "gross", accessorKey: "gross", title: "Incl. VAT" },
    ],
  },
];

const secondPage: State = { page: 2 };

function Products({
  initial = secondPage,
  held = false,
}: {
  initial?: State;
  /** A slow store: the changes wait for "Land the changes". */
  held?: boolean;
}) {
  const [state, setState] = useState<State>(initial);
  const [waiting] = useState<Array<(state: State) => State>>([]);

  const table = useDataTable({
    store: {
      state,
      update: (next) => (held ? waiting.push(next) : setState(next)),
    },
    defaultSorting: { column: "name", direction: "asc" },
  });

  return (
    <>
      <button type="button" onClick={() => waiting.splice(0).forEach((next) => setState(next))}>
        Land the changes
      </button>
      <DataTableColumnVisibility table={table} columns={columns} />
      <output aria-label="State">{JSON.stringify(table.state)}</output>
      <DataTable table={table} columns={columns} data={[{ name: "Desk", net: 100, gross: 120 }]} />
    </>
  );
}

const header = (name: string) => page.getByRole("columnheader", { name, exact: true });
const toggle = (name: string) => page.getByRole("menuitemcheckbox", { name, exact: true });

/** The state the table wrote, as the harness shows it. */
const expectState = (state: State) =>
  expect
    .element(page.getByRole("status", { name: "State" }))
    .toHaveTextContent(JSON.stringify(state));

describe("DataTableColumnVisibility", () => {
  it("hides a column in the state, on the same page, a group with its last column, and never the last column shown", async () => {
    await render(<Products />);

    await page.getByRole("button", { name: "Columns" }).click();
    await toggle("Price · Excl. VAT").click();

    await expect.element(header("Excl. VAT")).not.toBeInTheDocument();
    await expect.element(header("Price")).toBeVisible();
    await expectState({ page: 2, hidden: ["net"] });

    await toggle("Price · Incl. VAT").click();
    await expect.element(header("Price")).not.toBeInTheDocument();
    await expect.element(toggle("Name")).toBeDisabled();

    await toggle("Price · Excl. VAT").click();
    await toggle("Price · Incl. VAT").click();
    await expect.element(header("Incl. VAT")).toBeVisible();
    await expectState({ page: 2 });
  });

  it("never hides the last column shown, though the hides before it have not landed yet", async () => {
    await render(<Products held />);

    await page.getByRole("button", { name: "Columns" }).click();
    await toggle("Name").click();
    await toggle("Price · Excl. VAT").click();
    await toggle("Price · Incl. VAT").click();
    await userEvent.keyboard("{Escape}");
    await page.getByRole("button", { name: "Land the changes" }).click();

    await expectState({ page: 2, hidden: ["name", "net"] });
    await expect.element(header("Incl. VAT")).toBeVisible();
  });

  it("shows every column checked when the URL hides them all, and hides only the one unticked from there", async () => {
    await render(<Products initial={{ hidden: ["name", "net", "gross"] }} />);
    await expect.element(header("Name")).toBeVisible();

    await page.getByRole("button", { name: "Columns" }).click();

    for (const name of ["Name", "Price · Excl. VAT", "Price · Incl. VAT"])
      await expect.element(toggle(name)).toBeChecked();
    await toggle("Price · Excl. VAT").click();

    await expect.element(header("Excl. VAT")).not.toBeInTheDocument();
    await expect.element(header("Name")).toBeVisible();
    await expect.element(header("Incl. VAT")).toBeVisible();
    await expectState({ hidden: ["net"] });
  });

  it("counts the titled columns only to tell a URL that hides them all", async () => {
    type Person = { readonly name: string; readonly role: string };

    const people: ReadonlyArray<DataTableColumnFor<Person, State>> = [
      { id: "name", accessorKey: "name", title: "Name" },
      { id: "role", accessorKey: "role", title: "Role" },
      // No title: the menu does not offer it, so it does not count.
      { id: "actions", header: () => "Actions", cell: () => "Edit" },
    ];

    function People() {
      const [state, setState] = useState<State>({ hidden: ["name", "role"] });

      const table = useDataTable({
        store: { state, update: (next) => setState(next) },
        defaultSorting: { column: "name", direction: "asc" },
      });

      return (
        <>
          <DataTableColumnVisibility table={table} columns={people} />
          <DataTable table={table} columns={people} data={[{ name: "Ada", role: "admin" }]} />
        </>
      );
    }

    await render(<People />);

    await expect.element(header("Name")).toBeVisible();
    await expect.element(header("Role")).toBeVisible();
    await expect.element(header("Actions")).toBeVisible();
    await page.getByRole("button", { name: "Columns" }).click();
    await expect.element(toggle("Name")).toBeChecked();
    await expect.element(toggle("Role")).toBeChecked();
  });

  it("ticks its columns in boxes, shown unticked too, and names a nested column by its whole path", async () => {
    type Invoice = { readonly q1: number; readonly q2: number };

    const billing: ReadonlyArray<DataTableColumnFor<Invoice, State>> = [
      {
        id: "billing",
        title: "Billing",
        columns: [
          {
            id: "q1",
            title: "Q1",
            columns: [{ id: "q1-amount", accessorKey: "q1", title: "Amount" }],
          },
          {
            id: "q2",
            title: "Q2",
            columns: [{ id: "q2-amount", accessorKey: "q2", title: "Amount" }],
          },
        ],
      },
    ];

    function Invoices() {
      const [state, setState] = useState<State>({ hidden: ["q2-amount"] });

      const table = useDataTable({
        store: { state, update: (next) => setState(next) },
        defaultSorting: { column: "name", direction: "asc" },
      });

      return <DataTableColumnVisibility table={table} columns={billing} />;
    }

    await render(<Invoices />);

    await page.getByRole("button", { name: "Columns" }).click();
    const q1 = toggle("Billing · Q1 · Amount");
    const q2 = toggle("Billing · Q2 · Amount");
    await expect.element(q1).toBeChecked();
    await expect.element(q2).not.toBeChecked();
    const box = (item: typeof q1) => checkboxBox(item.element());
    expect(box(q2).getBoundingClientRect().width).toBeGreaterThan(0);
    expect(box(q2).querySelector("svg")).toBeNull();
    expect(box(q1).querySelector("svg")).not.toBeNull();
  });
});
