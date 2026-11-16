import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DataTableColumnHeader } from "@quack/ui/components/data-table-column-header";

const setup = async () => {
  const onSort = vi.fn();
  const onFilter = vi.fn(() => document.querySelector<HTMLInputElement>("#filter")?.focus());
  await render(
    <>
      <DataTableColumnHeader title="Email" sorted="asc" onSort={onSort} onFilter={onFilter} />
      <input id="filter" aria-label="Filter" />
    </>,
  );
  return { onSort, onFilter, trigger: page.getByRole("button", { name: "Email" }) };
};

describe("DataTableColumnHeader", () => {
  it("sorts the other way, and gives the focus back to the header", async () => {
    const { onSort, onFilter, trigger } = await setup();

    await trigger.click();
    await page.getByRole("menuitemradio", { name: "Descending" }).click();

    expect(onSort).toHaveBeenCalledWith("desc");
    await expect.element(trigger).toHaveFocus();
    expect(onFilter).not.toHaveBeenCalled();
  });

  it("asks for the filter once the menu has closed, and leaves the focus to it", async () => {
    const { onFilter, trigger } = await setup();

    await trigger.click();
    await page.getByRole("menuitem", { name: "Filter" }).click();

    await expect.poll(() => onFilter).toHaveBeenCalledOnce();
    expect(page.getByRole("menu").elements()).toHaveLength(0);
    await expect.element(page.getByRole("textbox", { name: "Filter" })).toHaveFocus();
  });

  it("asks for no filter when the menu closes on Escape after a filter", async () => {
    const { onFilter, trigger } = await setup();
    await trigger.click();
    await page.getByRole("menuitem", { name: "Filter" }).click();
    await expect.poll(() => onFilter).toHaveBeenCalledOnce();

    await trigger.click();
    await userEvent.keyboard("{Escape}");

    await expect.element(trigger).toHaveFocus();
    expect(onFilter).toHaveBeenCalledOnce();
  });
});
