import { checkServer, mount } from "@ui-sdk/core/testing";
import { describe, expect, it } from "vite-plus/test";

import { rowSelection, type RowSelectionRow } from "@quack/ui/lib/data-table/row-selection";

const rows: ReadonlyArray<RowSelectionRow> = [
  { value: "a", label: "Select Ada", selectable: true },
  { value: "b", label: "Select Alan", selectable: true },
  { value: "c", label: "Select Grace", selectable: false },
  { value: "d", label: "Select Linus", selectable: true },
  { value: "e", label: "Select Ken", selectable: true },
];
const markup = `<root>${rows
  .map((row) => `<row value="${row.value}" tabindex="0">${row.label}</row>`)
  .join("")}</root>`;

const open = (options: Parameters<typeof mount<typeof rowSelection>>[1] = {}) =>
  mount(rowSelection, { rows, ...options }, markup);

const focusRow = (view: ReturnType<typeof open>, id: string) => view.part("row", id)?.focus();

describe("rowSelection, from the keyboard", () => {
  it("selects the focused row with Space, and clears it with the next", async () => {
    const view = open();
    try {
      focusRow(view, "a");
      await view.keys("Space");
      expect(view.state.selected).toEqual(["a"]);
      expect(view.part("row", "a")?.getAttribute("data-state")).toBe("selected");
      expect(view.part("row", "b")?.hasAttribute("data-state")).toBe(false);
      expect(view.changes.at(-1)).toMatchObject({
        key: "selected",
        reason: "item-press",
        source: "keyboard",
      });

      await view.keys("Space");
      expect(view.state.selected).toEqual([]);
    } finally {
      view.unmount();
    }
  });

  it("selects the rows from the last one pressed with Shift + Space, skipping those that cannot be", async () => {
    const view = open();
    try {
      focusRow(view, "a");
      await view.keys("Space");
      focusRow(view, "e");
      await view.keys("Shift+Space");
      expect(view.state.selected.toSorted()).toEqual(["a", "b", "d", "e"]);
    } finally {
      view.unmount();
    }
  });

  it("clears the range from the last row pressed to a row that is selected, with Shift + Space", async () => {
    const view = open({ defaultSelected: ["a", "b", "d", "e"] });
    try {
      focusRow(view, "b");
      await view.keys("Space");
      expect(view.state.selected.toSorted()).toEqual(["a", "d", "e"]);
      focusRow(view, "e");
      await view.keys("Shift+Space");
      expect(view.state.selected).toEqual(["a"]);
    } finally {
      view.unmount();
    }
  });

  it("leaves a row that cannot be selected alone", async () => {
    const view = open();
    try {
      focusRow(view, "c");
      await view.keys("Space");
      expect(view.state.selected).toEqual([]);
      expect(view.changes).toEqual([]);
    } finally {
      view.unmount();
    }
  });

  it("ignores a held Space, but still keeps the page from scrolling", async () => {
    const view = open();
    try {
      const row = view.part("row", "a");
      const presses = [false, true].map((repeat) => {
        const press = new KeyboardEvent("keydown", {
          key: " ",
          repeat,
          bubbles: true,
          cancelable: true,
        });
        row?.dispatchEvent(press);
        return press;
      });
      expect(view.state.selected).toEqual(["a"]);
      expect(presses.map((press) => press.defaultPrevented)).toEqual([true, true]);
    } finally {
      view.unmount();
    }
  });

  it("leaves Space with Alt, Ctrl or Cmd to the browser", async () => {
    const view = open();
    try {
      const row = view.part("row", "a");
      for (const modifier of ["altKey", "ctrlKey", "metaKey"] as const) {
        const press = new KeyboardEvent("keydown", {
          key: " ",
          [modifier]: true,
          bubbles: true,
          cancelable: true,
        });
        row?.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(false);
      }
      expect(view.state.selected).toEqual([]);
    } finally {
      view.unmount();
    }
  });

  it("ignores Space on a control inside the row", async () => {
    const view = mount(
      rowSelection,
      { rows },
      `<root><row value="a">Ada<button type="button">Edit</button></row></root>`,
    );
    try {
      view.root.querySelector("button")?.focus();
      await view.keys("Space");
      expect(view.state.selected).toEqual([]);
    } finally {
      view.unmount();
    }
  });
});

describe("rowSelection, from code", () => {
  it("selects every row that can be, then clears them, and leaves the rows of other pages", () => {
    const view = open({ defaultSelected: ["elsewhere"] });
    try {
      view.api.toggleAll();
      expect(view.state.selected.toSorted()).toEqual(["a", "b", "d", "e", "elsewhere"]);
      expect(view.changes.at(-1)).toMatchObject({ reason: "select-all" });
      view.api.toggleAll();
      expect(view.state.selected).toEqual(["elsewhere"]);
    } finally {
      view.unmount();
    }
  });

  it("selects every row that can be, whatever was selected", () => {
    const view = open({ defaultSelected: ["a"] });
    try {
      view.api.selectAll();
      expect(view.state.selected.toSorted()).toEqual(["a", "b", "d", "e"]);
    } finally {
      view.unmount();
    }
  });

  it("clears the selection, the rows of other pages with it", () => {
    const view = open({ defaultSelected: ["a", "elsewhere"] });
    try {
      view.api.clear();
      expect(view.state.selected).toEqual([]);
      expect(view.changes.at(-1)).toMatchObject({ reason: "clear" });
    } finally {
      view.unmount();
    }
  });

  it("toggles a row that can be selected, and refuses one that cannot", () => {
    const view = open();
    try {
      view.api.toggle("c");
      view.api.toggle("unknown");
      expect(view.state.selected).toEqual([]);
      view.api.toggle("b");
      expect(view.state.selected).toEqual(["b"]);
    } finally {
      view.unmount();
    }
  });

  it("offers an agent the rows that can be selected, by their label", () => {
    const view = open();
    try {
      expect(view.api.items().map((item) => item.label)).toEqual([
        "Select Ada",
        "Select Alan",
        "Select Linus",
        "Select Ken",
      ]);
    } finally {
      view.unmount();
    }
  });

  it("reports each change to the app, which can refuse it", () => {
    const seen: Array<ReadonlyArray<string>> = [];
    const view = open({
      onSelectedChange: (selected, details) => {
        seen.push(selected);
        if (selected.includes("b")) details.cancel();
      },
    });
    try {
      view.api.toggle("a");
      view.api.toggle("b");
      expect(seen).toEqual([["a"], ["a", "b"]]);
      expect(view.state.selected).toEqual(["a"]);
    } finally {
      view.unmount();
    }
  });

  it("shows the selection the app passes, and keeps showing it while the app does not take a change", () => {
    const view = open({ selected: ["a"] });
    try {
      expect(view.part("row", "a")?.getAttribute("data-state")).toBe("selected");
      view.api.toggle("b");
      // The selection is the app's: it did not take the change.
      expect(view.state.selected).toEqual(["a"]);
    } finally {
      view.unmount();
    }
  });

  it("remembers Shift on the press of a box, once", async () => {
    const view = mount(
      rowSelection,
      { rows },
      `<root><box><button type="button">Select Ada</button></box></root>`,
    );
    try {
      expect(view.api.takeShift()).toBe(false);
      view.root
        .querySelector("button")
        ?.dispatchEvent(new PointerEvent("pointerdown", { shiftKey: true, bubbles: true }));
      expect(view.api.takeShift()).toBe(true);
      expect(view.api.takeShift()).toBe(false);
    } finally {
      view.unmount();
    }
  });
});

describe("rowSelection, rendered", () => {
  it("renders on the server", () => {
    const html = checkServer(rowSelection, { rows, defaultSelected: ["a"] }, markup);
    expect(html).toContain('data-state="selected"');
  });

  // `checkDirection` compares the horizontal arrows between left to right and right to left, and fails for a primitive
  // with none: the rows move with the vertical arrows, which the table owns. What reading direction could change is
  // the keys it does handle.
  it("selects with the same keys in right-to-left text", async () => {
    document.documentElement.dir = "rtl";
    const view = open();
    try {
      focusRow(view, "a");
      await view.keys("Space");
      focusRow(view, "e");
      await view.keys("Shift+Space");
      expect(view.state.selected.toSorted()).toEqual(["a", "b", "d", "e"]);
    } finally {
      view.unmount();
      document.documentElement.removeAttribute("dir");
    }
  });
});
