import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DataTable, type DataTableColumnFor } from "@quack/ui/components/data-table/data-table";
import { useDataTableSelection } from "@quack/ui/components/data-table/selection";
import { useDataTable } from "@quack/ui/hooks/use-data-table";
import { useMemoryDataTableStore } from "@quack/ui/hooks/use-memory-data-table-store";
import { elementOf, slot } from "@quack/ui/testing/dom";

type Person = { readonly id: string; readonly name: string; readonly city: string };
type State = {
  readonly page?: number | undefined;
  readonly orderBy?: "name" | undefined;
  readonly dir?: "asc" | "desc" | undefined;
  readonly hidden?: ReadonlyArray<string> | undefined;
  readonly pinned?: ReadonlyArray<string> | undefined;
};

const people: ReadonlyArray<Person> = [
  { id: "p-1", name: "Ada Lovelace", city: "London" },
  { id: "p-2", name: "Alan Turing", city: "Wilmslow" },
];

const wide = "inline-block w-80";

const columnsWith = (
  onAction: (id: string) => void,
): ReadonlyArray<DataTableColumnFor<Person, State>> => [
  {
    id: "name",
    accessorKey: "name",
    title: "Name",
    cell: ({ getValue }) => <span className={wide}>{String(getValue())}</span>,
  },
  {
    id: "city",
    accessorKey: "city",
    title: "City",
    cell: ({ getValue }) => <span className={wide}>{String(getValue())}</span>,
  },
  {
    id: "actions",
    sticky: "end",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <button type="button" onClick={() => onAction(row.original.id)}>
        Edit {row.original.name}
      </button>
    ),
  },
];

const linkOf = (person: Person) => <a href={`#${person.id}`} aria-label={person.name} />;

function People({
  onAction,
  pinned,
  selectable = false,
}: {
  onAction: (id: string) => void;
  pinned?: ReadonlyArray<string>;
  selectable?: boolean;
}) {
  const store = useMemoryDataTableStore<State>(pinned === undefined ? {} : { pinned });
  const table = useDataTable({ store, defaultSorting: { column: "name", direction: "asc" } });
  const selection = useDataTableSelection<Person>();
  return (
    <div className="flex h-75 w-100 flex-col">
      <DataTable
        table={table}
        columns={columnsWith(onAction)}
        data={people}
        label="People"
        getRowId={(person) => person.id}
        rowLink={linkOf}
        {...(selectable && { selection })}
      />
    </div>
  );
}

const setup = async (props: { pinned?: ReadonlyArray<string>; selectable?: boolean } = {}) => {
  const onAction = vi.fn();
  await render(<People onAction={onAction} {...props} />);
  await expect.element(page.getByText("Alan Turing", { exact: true })).toBeVisible();
  return { onAction };
};

/** What a click at the center of `element` lands on. */
const centerOf = (element: Element) => {
  const box = element.getBoundingClientRect();
  return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
};

const rowOf = (name: string) => page.getByRole("row").filter({ hasText: name });

afterEach(() => {
  history.replaceState(null, "", location.pathname + location.search);
});

describe("DataTable with rowLink", () => {
  it("links each row once for assistive tech, by its accessible name", async () => {
    await setup({ selectable: true });

    expect(
      page
        .getByRole("link")
        .elements()
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#p-1", "#p-2"]);
    await expect.element(page.getByRole("link", { name: "Alan Turing" })).toBeInTheDocument();
    // Every cell but the checkbox's: the name, the city, and the actions.
    expect(rowOf("Alan Turing").element().querySelectorAll("a[href='#p-2']")).toHaveLength(3);
  });

  it("follows the link of a row clicked in one of its cells", async () => {
    await setup();

    // The cell, not its text: the link covers the text, and would take the click from it.
    await rowOf("Alan Turing").getByRole("cell").first().click();

    expect(location.hash).toBe("#p-2");
  });

  it("follows the link of the row focused with Enter", async () => {
    await setup();
    const row = rowOf("Ada Lovelace");
    elementOf(HTMLElement, row.element()).focus();
    await expect.element(row).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(location.hash).toBe("#p-2");
  });

  it("leaves the controls of a row to their own action", async () => {
    const { onAction } = await setup();

    await page.getByRole("button", { name: "Edit Ada Lovelace" }).click();

    expect(onAction).toHaveBeenCalledWith("p-1");
    expect(location.hash).toBe("");
  });

  it("keeps the pinned cells and their checkboxes above the links of the cells that slide under them", async () => {
    await setup({ pinned: ["name"], selectable: true });
    const name = elementOf(HTMLElement, rowOf("Ada Lovelace").getByRole("cell").nth(1).element());
    const checkbox = page.getByRole("checkbox", { name: "Select row" }).first();
    const city = () => rowOf("Ada Lovelace").getByText("London").element().getBoundingClientRect();
    const nameRight = name.getBoundingClientRect().right;

    slot("scroll-area-viewport").scrollLeft = 300;

    // The city slides under the pinned name: what is hit there is the name's cell, not the city's link.
    await expect.poll(() => city().left).toBeLessThan(nameRight);
    expect(name.contains(centerOf(name))).toBe(true);
    expect(checkbox.element().contains(centerOf(checkbox.element()))).toBe(true);
    await checkbox.click();
    await expect.element(checkbox).toBeChecked();
    expect(location.hash).toBe("");
  });
});
