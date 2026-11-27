import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ToggleGroup, ToggleGroupItem } from "@quack/ui/components/toggle-group";

function Days({ onValueChange }: { onValueChange: (days: Array<string>) => void }) {
  return (
    <ToggleGroup multiple aria-label="Days" onValueChange={onValueChange}>
      <ToggleGroupItem value="mon">Mon</ToggleGroupItem>
      <ToggleGroupItem value="tue">Tue</ToggleGroupItem>
      <ToggleGroupItem value="wed">Wed</ToggleGroupItem>
    </ToggleGroup>
  );
}

describe("ToggleGroup", () => {
  it("keeps several items pressed, and reports them in their order", async () => {
    const onValueChange = vi.fn();
    await render(<Days onValueChange={onValueChange} />);

    await page.getByRole("button", { name: "Wed" }).click();
    await page.getByRole("button", { name: "Mon" }).click();

    await expect
      .element(page.getByRole("button", { name: "Mon" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect
      .element(page.getByRole("button", { name: "Tue" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(onValueChange).toHaveBeenLastCalledWith(["mon", "wed"], expect.anything());
  });

  it("moves between its items with the arrow keys and presses one with Space", async () => {
    const onValueChange = vi.fn();
    await render(<Days onValueChange={onValueChange} />);

    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");

    await expect.element(page.getByRole("button", { name: "Tue" })).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith(["tue"], expect.anything());
  });
});
