import { checkServer, mount } from "@ui-sdk/core/testing";
import { describe, expect, it, vi } from "vite-plus/test";

import { selectionBar } from "@quack/ui/lib/data-table/selection-bar";

const markup = `<root><status></status><bar><button type="button">Archive</button><button type="button">Clear</button></bar></root>`;

describe("selectionBar", () => {
  it("is a region named by the count, hidden while nothing is selected", () => {
    const view = mount(selectionBar, { count: 0 }, markup);
    try {
      const bar = view.part("bar");
      expect(bar?.getAttribute("role")).toBe("region");
      expect(bar?.hasAttribute("hidden")).toBe(true);
      expect(view.part("status")?.getAttribute("role")).toBe("status");
    } finally {
      view.unmount();
    }
  });

  it("is shown, and named, from the first row selected", () => {
    const view = mount(selectionBar, { count: 3 }, markup);
    try {
      expect(view.part("bar")?.hasAttribute("hidden")).toBe(false);
      expect(view.part("bar")?.getAttribute("aria-label")).toBe("3 selected");
    } finally {
      view.unmount();
    }
  });

  it("clears the selection through the app's callback", () => {
    const onClear = vi.fn();
    const view = mount(selectionBar, { count: 2, onClear }, markup);
    try {
      view.api.clear();
      expect(onClear).toHaveBeenCalledOnce();
    } finally {
      view.unmount();
    }
  });

  it("renders on the server", () => {
    const html = checkServer(selectionBar, { count: 2 }, markup);
    expect(html).toContain("2 selected");
  });
});
