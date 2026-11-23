import { checkPattern } from "@ui-sdk/core/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Switch } from "@quack/ui/components/switch";
import { slot } from "@quack/ui/testing/dom";

describe("Switch", () => {
  it("follows the switch pattern", async () => {
    const screen = await render(<Switch aria-label="Notifications" />);

    await checkPattern(screen.container, "switch");
  });

  it("toggles on Space and on a click, and reports each change", async () => {
    const onCheckedChange = vi.fn();
    await render(<Switch aria-label="Notifications" onCheckedChange={onCheckedChange} />);
    const control = page.getByRole("switch", { name: "Notifications" });

    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard(" ");
    await expect.element(control).toBeChecked();
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());

    await control.click();
    await expect.element(control).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it("slides its thumb to the end once checked", async () => {
    await render(<Switch aria-label="Notifications" />);
    const thumb = slot("switch-thumb");
    const left = () => thumb.getBoundingClientRect().left;
    const resting = left();

    await page.getByRole("switch").click();

    await expect.poll(left).toBeGreaterThan(resting);
  });

  it("once disabled, says so and ignores Space", async () => {
    await render(<Switch aria-label="Notifications" disabled />);
    const control = page.getByRole("switch", { name: "Notifications" });

    await expect.element(control).toBeDisabled();
    control.element().focus();
    await userEvent.keyboard(" ");
    await expect.element(control).not.toBeChecked();
  });
});
