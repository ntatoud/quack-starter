import { checkPattern } from "@ui-sdk/core/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Checkbox } from "@quack/ui/components/checkbox";

describe("Checkbox", () => {
  it("follows the checkbox pattern", async () => {
    const screen = await render(<Checkbox aria-label="Accept the terms" />);

    await checkPattern(screen.container, "checkbox");
  });

  it("checks on Space and reports it", async () => {
    const onCheckedChange = vi.fn();
    await render(<Checkbox aria-label="Accept the terms" onCheckedChange={onCheckedChange} />);
    const control = page.getByRole("checkbox", { name: "Accept the terms" });

    await userEvent.keyboard("{Tab} ");

    await expect.element(control).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true, expect.anything());
  });

  it("shows a check once checked, and a dash while partly checked", async () => {
    const screen = await render(<Checkbox aria-label="All rows" checked />);
    const icon = () => screen.container.querySelector("svg")?.getAttribute("class") ?? "";
    await expect.poll(icon).toContain("lucide-check");

    await screen.rerender(<Checkbox aria-label="All rows" checked="indeterminate" />);

    await expect
      .element(page.getByRole("checkbox", { name: "All rows" }))
      .toHaveAttribute("aria-checked", "mixed");
    await expect.poll(icon).toContain("lucide-minus");
  });
});
