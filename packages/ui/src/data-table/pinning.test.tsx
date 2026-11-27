import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import {
  DataTable,
  type DataTableColumnFor,
  DataTableColumnVisibility,
  useDataTable,
  useDataTableSelection,
  useMemoryDataTableStore,
} from "@quack/ui/data-table";

import { render } from "vitest-browser-react";
import { elementOf, slot } from "@quack/ui/testing/dom";

type Person = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly team: string;
  readonly city: string;
  readonly net: number;
  readonly gross: number;
};

type State = {
  readonly page?: number | undefined;
  readonly orderBy?: "name" | undefined;
  readonly dir?: "asc" | "desc" | undefined;
  readonly hidden?: ReadonlyArray<string> | undefined;
  readonly pinned?: ReadonlyArray<string> | undefined;
};

const titled = (id: Exclude<keyof Person, "id" | "net" | "gross">, title: string) =>
  ({ id, accessorKey: id, title }) as const;

const columns: ReadonlyArray<DataTableColumnFor<Person, State>> = [
  titled("name", "Name"),
  titled("email", "Email"),
  titled("role", "Role"),
  titled("team", "Team"),
  titled("city", "City"),
  {
    id: "prices",
    title: "Price",
    columns: [
      { id: "net", accessorKey: "net", title: "Excl. VAT" },
      { id: "gross", accessorKey: "gross", title: "Incl. VAT" },
    ],
  },
];

const people: ReadonlyArray<Person> = [
  {
    id: "p-1",
    name: "Ada Lovelace of the Analytical Engine",
    email: "ada.lovelace@analytical-engine.example",
    role: "Mathematician and first programmer",
    team: "Difference Engine research team",
    city: "London, United Kingdom of Great Britain",
    net: 100,
    gross: 120,
  },
];

const unpinned: State = {};

function People({
  initial = unpinned,
  selectable = false,
}: {
  initial?: State;
  selectable?: boolean;
}) {
  const store = useMemoryDataTableStore<State>(initial);

  const table = useDataTable({
    store,
    defaultSorting: { column: "name", direction: "asc" },
  });

  const selection = useDataTableSelection<Person>();

  return (
    <>
      <DataTableColumnVisibility table={table} columns={columns} />
      <output aria-label="State">{JSON.stringify(table.state)}</output>
      <div className="flex h-75 w-150 flex-col">
        <DataTable
          table={table}
          columns={columns}
          data={people}
          getRowId={(person) => person.id}
          {...(selectable && { selection })}
        />
      </div>
    </>
  );
}

const header = (name: string) =>
  elementOf(HTMLElement, page.getByRole("columnheader", { name, exact: true }).element());

/** The headers of the first header row, in their order: the columns outside a group, and the groups. */
const order = () => document.querySelectorAll("thead tr:first-child th");
const viewport = () => slot("scroll-area-viewport");
const state = () => page.getByRole("status", { name: "State" });
const box = (name: string) => header(name).getBoundingClientRect();

// The line a pinned cell draws on its end side: a horizontal inset shadow, unlike the line under the header.
const endEdge = { ltr: /\) -1px 0px 0px/, rtl: /\) 1px 0px 0px/ };

describe("DataTable pinned columns", () => {
  it("pins columns from the menu, which stays open, in the order they were pinned", async () => {
    await render(<People />);
    await page.getByRole("button", { name: "Columns" }).click();

    await page.getByRole("menuitemcheckbox", { name: "Pin Email" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Pin Role" }).click();

    await expect.element(state()).toHaveTextContent(JSON.stringify({ pinned: ["email", "role"] }));
    await expect.element(page.getByRole("menuitemcheckbox", { name: "Pin Role" })).toBeChecked();
    const titles = [...order()].map((cell) => cell.textContent);
    expect(titles.slice(0, 3)).toEqual(["Email", "Role", "Name"]);
  });

  it("offers no pin for a column of a group, and ignores a pin on one", async () => {
    await render(<People initial={{ pinned: ["net"] }} />);
    await page.getByRole("button", { name: "Columns" }).click();

    await expect.element(page.getByRole("menuitemcheckbox", { name: "Pin Name" })).toBeVisible();
    expect(page.getByRole("menuitemcheckbox", { name: /^Pin .*VAT/ }).elements()).toHaveLength(0);
    expect(getComputedStyle(header("Excl. VAT")).position).not.toBe("sticky");
    expect(order()[0]).toHaveTextContent("Name");
  });

  it("holds the pinned columns, after the checkboxes, while the others slide under them", async () => {
    await render(<People initial={{ pinned: ["name", "email"] }} selectable />);

    const select = elementOf(
      HTMLElement,
      page.getByRole("checkbox", { name: "Select all rows shown" }).element().closest("th"),
    );

    await expect.element(header("Name")).toBeVisible();

    // Each pinned column starts where the one before it ends, the checkboxes first.
    await expect
      .poll(() => box("Name").left - select.getBoundingClientRect().right)
      .toBeCloseTo(0, 0);
    expect(box("Email").left - box("Name").right).toBeCloseTo(0, 0);
    // The offsets follow the widths a frame later, so a header whose width settled after the first render (a font
    // arriving) is not yet held where it sits: scrolling before then would hold it short.
    await expect
      .poll(() =>
        Math.abs(
          Number.parseFloat(getComputedStyle(header("Email")).getPropertyValue("--pin-start")) -
            (box("Email").left - select.getBoundingClientRect().left),
        ),
      )
      .toBeLessThan(0.5);
    expect(getComputedStyle(header("Email")).boxShadow).not.toMatch(endEdge.ltr);

    const [selectLeft, nameLeft, emailLeft, roleLeft] = [
      select.getBoundingClientRect().left,
      box("Name").left,
      box("Email").left,
      box("Role").left,
    ];

    viewport().scrollLeft = 200;

    await expect.poll(() => box("Role").left).toBeLessThan(roleLeft);
    // In place, to the subpixel the sticky position rounds to.
    expect(select.getBoundingClientRect().left).toBeCloseTo(selectLeft, 0);
    expect(box("Name").left).toBeCloseTo(nameLeft, 0);
    expect(box("Email").left).toBeCloseTo(emailLeft, 0);
    await expect.poll(() => getComputedStyle(header("Email")).boxShadow).toMatch(endEdge.ltr);
    expect(getComputedStyle(header("Name")).boxShadow).not.toMatch(endEdge.ltr);
  });

  it("holds them at the right edge, right to left", async () => {
    await render(
      <div dir="rtl">
        <People initial={{ pinned: ["name"] }} />
      </div>,
    );
    await expect.element(header("Name")).toBeVisible();
    await expect
      .poll(() => viewport().getBoundingClientRect().right - box("Name").right)
      .toBeLessThan(2);
    const [nameLeft, emailRight] = [box("Name").left, box("Email").right];
    expect(getComputedStyle(header("Name")).boxShadow).not.toMatch(endEdge.rtl);

    viewport().scrollLeft = -200;

    await expect.poll(() => box("Email").right).toBeGreaterThan(emailRight);
    expect(box("Name").left).toBeCloseTo(nameLeft, 0);
    await expect.poll(() => getComputedStyle(header("Name")).boxShadow).toMatch(endEdge.rtl);
  });
});
