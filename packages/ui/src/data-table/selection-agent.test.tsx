import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { cleanup, render } from "vitest-browser-react";

import {
  DataTable,
  type DataTableColumn,
  DataTableSelectionBar,
  useDataTableSelection,
} from "@quack/ui/data-table";

type Person = { id: string; name: string; locked?: boolean };

const people: ReadonlyArray<Person> = [
  { id: "p-1", name: "Ada" },
  { id: "p-2", name: "Alan" },
  { id: "p-3", name: "Grace", locked: true },
  { id: "p-4", name: "Linus" },
];

const columns: ReadonlyArray<DataTableColumn<Person>> = [
  { id: "name", accessorKey: "name", title: "Name" },
];

function People() {
  const selection = useDataTableSelection<Person>({
    rowLabel: (person) => `Select ${person.name}`,
    canSelect: (person) => !person.locked,
  });

  return (
    <>
      <DataTableSelectionBar count={selection.count} onClear={selection.clear} />
      <DataTable
        columns={columns}
        data={people}
        label="People"
        getRowId={(person) => person.id}
        selection={selection}
      />
    </>
  );
}

// One bridge for the file: it has no `destroy`, and remembers the components of earlier tests as off the page.
const agent = createAgent();

afterEach(cleanup);

const entry = (label: string) => agent.snapshot().find((component) => component.label === label);

type Step = Parameters<typeof agent.act>[0]["steps"][number];

/** Runs the steps, and fails the test with the agent's reason when it could not. */
const act = async (...steps: Array<Step>) => {
  const result = await agent.act({ steps });
  expect(result.ok, result.error?.message).toBe(true);
};

describe("DataTable selection, for an agent", () => {
  it("names every control of the selection, and offers the rows that can be selected", async () => {
    await render(<People />);

    const components = agent
      .snapshot()
      .filter((component) => !component.offPage && component.component !== "more");

    for (const component of components)
      expect(component.label, `${component.component} ${component.ref} has no name`).toBeTruthy();
    const labels = components.map((component) => component.label);

    for (const label of ["Selection of People", "Select Ada", "Select all rows shown"])
      expect(labels, `${label} is missing from the snapshot`).toContain(label);

    const table = entry("Selection of People");
    expect(table?.actions).toEqual(expect.arrayContaining(["toggle", "selectAll", "clear"]));
    expect(JSON.stringify(table)).toContain("Select Linus");
    expect(JSON.stringify(table)).not.toContain("Select Grace");
  });

  it("selects a row, the rows that can be, then clears them, as the bar and the checkboxes show", async () => {
    await render(<People />);

    expect(entry("Selection of People")?.items).toContainEqual(
      expect.objectContaining({ value: "p-1" }),
    );

    await act({ ref: "Selection of People", action: "toggle", args: ["p-1"] });
    await expect.element(page.getByRole("checkbox", { name: "Select Ada" })).toBeChecked();
    await expect.element(page.getByRole("region", { name: "1 selected" })).toBeVisible();

    await act({ ref: "Selection of People", action: "selectAll" });
    await expect.element(page.getByRole("region", { name: "3 selected" })).toBeVisible();
    await expect.element(page.getByRole("checkbox", { name: "Select Grace" })).not.toBeChecked();

    await act({ ref: "Selection of People", action: "clear" });
    await expect.element(page.getByRole("region", { name: /selected/ })).not.toBeInTheDocument();
  });

  it("does not select a row that cannot be", async () => {
    await render(<People />);

    await act({ ref: "Selection of People", action: "toggle", args: ["p-3"] });
    await expect.element(page.getByRole("checkbox", { name: "Select Grace" })).not.toBeChecked();
    expect(page.getByRole("region", { name: /selected/ }).elements()).toHaveLength(0);
  });

  it("sets the box of a row to what it already is without toggling it", async () => {
    await render(<People />);
    await act({ ref: "Select Ada", action: "setChecked", args: [true] });
    await act({ ref: "Select Ada", action: "setChecked", args: [true] });

    await expect.element(page.getByRole("checkbox", { name: "Select Ada" })).toBeChecked();
    await expect.element(page.getByRole("region", { name: "1 selected" })).toBeVisible();
  });
});
