import { checkServer, mount } from "@ui-sdk/core/testing";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { selectionBar } from "@quack/ui/lib/data-table/selection-bar";
import { elementOf } from "@quack/ui/testing/dom";

const markup = `<root><status></status><bar><button type="button">Archive</button><button type="button">Clear</button></bar></root>`;

/** Mounts the bar, unmounted when the test ends. */
const open = (options: Parameters<typeof mount<typeof selectionBar>>[1]) => {
  const view = mount(selectionBar, options, markup);
  onTestFinished(() => view.unmount());

  return {
    view,
    bar: elementOf(HTMLElement, view.part("bar")),
    status: elementOf(HTMLElement, view.part("status")),
  };
};

describe("selectionBar", () => {
  it("is a region named by the count, hidden while nothing is selected", () => {
    const { bar, status } = open({ count: 0 });

    expect(bar.getAttribute("role")).toBe("region");
    expect(bar.hasAttribute("hidden")).toBe(true);
    expect(status.getAttribute("role")).toBe("status");
  });

  it("is shown, and named, from the first row selected", () => {
    const { bar } = open({ count: 3 });

    expect(bar.hasAttribute("hidden")).toBe(false);
    expect(bar.getAttribute("aria-label")).toBe("3 selected");
  });

  it("clears the selection through the app's callback", () => {
    const onClear = vi.fn();
    const { view } = open({ count: 2, onClear });

    view.api.clear();

    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders on the server", () => {
    const html = checkServer(selectionBar, { count: 2 }, markup);
    expect(html).toContain("2 selected");
  });
});
