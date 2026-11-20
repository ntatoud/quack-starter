import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ToggleForm } from "#/testing/toggle-form.tsx";

describe("field.Switch", () => {
  it("is a switch named by its label and described by its description, in its state", async () => {
    await render(<ToggleForm initial onChange={() => {}} />);
    const toggle = page.getByRole("switch", { name: "Newsletter" });

    await expect.element(toggle).toBeChecked();
    await expect.element(toggle).toHaveAccessibleDescription("Once a month.");
  });

  it("turns on and off with a click or the keyboard", async () => {
    const changes: Array<boolean> = [];
    await render(<ToggleForm initial={false} onChange={(value) => changes.push(value)} />);
    const toggle = page.getByRole("switch", { name: "Newsletter" });

    await toggle.click();
    await expect.element(toggle).toBeChecked();
    await userEvent.keyboard(" ");

    await expect.element(toggle).not.toBeChecked();
    expect(changes).toEqual([true, false]);
  });

  it("turns on from a click on its label", async () => {
    await render(<ToggleForm initial={false} onChange={() => {}} />);

    await page.getByText("Newsletter", { exact: true }).click();

    await expect.element(page.getByRole("switch", { name: "Newsletter" })).toBeChecked();
  });
});
