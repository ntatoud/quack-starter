import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import {
  booleanFilter,
  DataTableToolbar,
  useDataTable,
  useMemoryDataTableStore,
} from "@quack/ui/data-table";

import { render } from "vitest-browser-react";

type State = { readonly onboarded?: boolean | undefined };

function Toolbar({ initial }: { initial: State }) {
  const store = useMemoryDataTableStore<State>(initial);

  const table = useDataTable({
    store,
    defaultSorting: { column: "name", direction: "asc" },
    filters: { onboarded: booleanFilter({ title: "Onboarded" }) },
  });

  return (
    <>
      <DataTableToolbar table={table} />
      <output>{JSON.stringify(store.state)}</output>
    </>
  );
}

const chip = () =>
  page.getByRole("group", { name: "Onboarded filter" }).getByRole("button").first();

describe("booleanFilter", () => {
  it("holds false, not an empty value, once No is chosen", async () => {
    await render(<Toolbar initial={{}} />);

    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("menuitem", { name: "Onboarded" }).click();
    await page.getByRole("menuitemradio", { name: "No" }).click();

    await expect.element(page.getByRole("status").last()).toHaveTextContent('{"onboarded":false}');
    await expect.element(chip()).toHaveTextContent("Onboarded:No");
  });

  it("marks the value held, and clears it", async () => {
    await render(<Toolbar initial={{ onboarded: true }} />);

    await chip().click();
    await expect
      .element(page.getByRole("menuitemradio", { name: "Yes" }))
      .toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitem", { name: "Clear" }).click();

    await expect.element(page.getByRole("status").last()).toHaveTextContent("{}");
  });
});
