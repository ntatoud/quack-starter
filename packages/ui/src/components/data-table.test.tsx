import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DataTable, type DataTableColumn } from "@quack/ui/components/data-table";

const columnsOf = (count: number): ReadonlyArray<DataTableColumn<{ id: string }>> =>
  Array.from({ length: count }, (_, i) => ({
    id: `column-${i}`,
    header: `A rather long header ${i}`,
    cell: () => "value",
  }));

const slot = (name: string) => {
  const element = document.querySelector(`[data-slot=${name}]`);
  if (!(element instanceof HTMLElement)) throw new Error(`No ${name}.`);
  return element;
};

const setup = async (columns: number, rows = 1) => {
  await render(
    <div style={{ width: 400, height: 300, display: "flex", flexDirection: "column" }}>
      <DataTable
        columns={columnsOf(columns)}
        data={Array.from({ length: rows }, (_, i) => ({ id: String(i) }))}
      />
    </div>,
  );
  await expect.element(page.getByRole("table")).toBeVisible();
  return {
    viewport: slot("data-table-viewport"),
    shown: (name: "start" | "end") => getComputedStyle(slot(`data-table-overflow-${name}`)).opacity,
  };
};

describe("DataTable", () => {
  it("shades the edge past which columns are hidden, and moves the shade as it scrolls", async () => {
    const { viewport, shown } = await setup(8);

    await expect.poll(() => shown("end")).toBe("1");
    expect(shown("start")).toBe("0");

    viewport.scrollLeft = viewport.scrollWidth;

    await expect.poll(() => shown("start")).toBe("1");
    await expect.poll(() => shown("end")).toBe("0");
  });

  it("shades no edge when every column fits", async () => {
    const { shown } = await setup(1);

    await expect.poll(() => shown("end")).toBe("0");
    expect(shown("start")).toBe("0");
  });

  it("keeps the last row above the horizontal scrollbar once scrolled to the bottom", async () => {
    const { viewport } = await setup(8, 30);
    const scrollbar = document.querySelector(
      "[data-slot=scroll-area-scrollbar][data-orientation=horizontal]",
    );
    if (!(scrollbar instanceof HTMLElement)) throw new Error("No horizontal scrollbar.");
    await expect.poll(() => scrollbar.getBoundingClientRect().height).toBeGreaterThan(0);

    viewport.scrollTop = viewport.scrollHeight;

    const rows = page.getByRole("row").elements();
    const lastRow = rows.at(-1)?.getBoundingClientRect();
    expect(lastRow?.bottom).toBeLessThanOrEqual(scrollbar.getBoundingClientRect().top);
  });
});
