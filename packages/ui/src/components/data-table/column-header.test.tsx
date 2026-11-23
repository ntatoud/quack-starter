import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { DataTableColumnHeader } from "@quack/ui/components/data-table/column-header";

import { render } from "vitest-browser-react";
import { elementOf } from "@quack/ui/testing/dom";

const setup = async () => {
  const onSort = vi.fn();

  const onFilter = vi.fn(() =>
    elementOf(HTMLInputElement, document.getElementById("filter")).focus(),
  );

  await render(
    <>
      <DataTableColumnHeader title="Email" sorted="asc" onSort={onSort} onFilter={onFilter} />
      <input id="filter" aria-label="Filter" />
    </>,
  );

  return {
    onSort,
    onFilter,
    trigger: page.getByRole("button", { name: "Email" }),
  };
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

  it("opens the filter at once from a column that does not sort, with no menu", async () => {
    const onFilter = vi.fn();
    await render(<DataTableColumnHeader title="Tags" onFilter={onFilter} />);

    const button = page.getByRole("button", { name: "Tags", exact: true });
    await expect.element(button).toHaveAccessibleDescription("Filter");
    await button.click();

    expect(onFilter).toHaveBeenCalledOnce();
    expect(page.getByRole("menu").elements()).toHaveLength(0);
  });

  it("shows how a column sorts: up, down, or both ways while unsorted", async () => {
    const screen = await render(
      <DataTableColumnHeader title="Email" sorted={undefined} onSort={vi.fn()} />,
    );

    const icon = () =>
      elementOf(
        SVGElement,
        page.getByRole("button", { name: "Email" }).element().querySelector("svg"),
      );

    expect(icon()).toHaveClass("lucide-chevrons-up-down");
    await screen.rerender(<DataTableColumnHeader title="Email" sorted="asc" onSort={vi.fn()} />);
    expect(icon()).toHaveClass("lucide-arrow-up");
    await screen.rerender(<DataTableColumnHeader title="Email" sorted="desc" onSort={vi.fn()} />);
    expect(icon()).toHaveClass("lucide-arrow-down");
  });

  it("puts its icon before the title at the end of the cell", async () => {
    await render(
      <>
        <DataTableColumnHeader title="Amount" align="end" onFilter={vi.fn()} />
        <DataTableColumnHeader title="Total" align="end" sorted="asc" onSort={vi.fn()} />
      </>,
    );

    for (const name of ["Amount", "Total"]) {
      const html = page.getByRole("button", { name }).element().innerHTML;
      expect(html.indexOf("<svg")).toBeLessThan(html.indexOf(name));
      expect(html.indexOf("<svg")).toBeGreaterThanOrEqual(0);
    }
  });
});
