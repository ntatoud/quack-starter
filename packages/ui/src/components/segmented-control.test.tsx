import { checkPattern } from "@ui-sdk/core/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SegmentedControl, SegmentedControlItem } from "@quack/ui/components/segmented-control";
import { slot } from "@quack/ui/testing/dom";

const Views = ({
  onValueChange = vi.fn(),
  dir = "ltr",
}: {
  onValueChange?: () => void;
  dir?: "ltr" | "rtl";
}) => (
  <div dir={dir}>
    <SegmentedControl aria-label="View" defaultValue="list" onValueChange={onValueChange}>
      <SegmentedControlItem value="list">List</SegmentedControlItem>
      <SegmentedControlItem value="grid">Grid</SegmentedControlItem>
      <SegmentedControlItem value="board">Board</SegmentedControlItem>
    </SegmentedControl>
  </div>
);

describe("SegmentedControl", () => {
  it("follows the radio group pattern", async () => {
    const screen = await render(<Views />);

    await checkPattern(screen.container, "radio-group");
  });

  it("is one tab stop, and the arrows check the next item", async () => {
    const onValueChange = vi.fn();
    await render(<Views onValueChange={onValueChange} />);

    await userEvent.keyboard("{Tab}");
    await expect.element(page.getByRole("radio", { name: "List" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    await expect.element(page.getByRole("radio", { name: "Grid" })).toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("grid", expect.anything());

    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await userEvent.keyboard("{Tab}");
    await expect.element(page.getByRole("radio", { name: "Grid" })).toHaveFocus();
  });

  it("swaps the arrows in right to left text", async () => {
    await render(<Views dir="rtl" />);

    await userEvent.keyboard("{Tab}{ArrowLeft}");

    await expect.element(page.getByRole("radio", { name: "Grid" })).toBeChecked();
  });

  it("slides its indicator under the checked item", async () => {
    await render(<Views />);
    const indicator = slot("segmented-control-indicator");

    const board = page.getByRole("radio", { name: "Board" });

    await board.click();

    await expect
      .poll(() => indicator.getBoundingClientRect().left)
      .toBeCloseTo(board.element().getBoundingClientRect().left, 0);
  });
});
