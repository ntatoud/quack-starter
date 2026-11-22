import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ColorForm, OptionalColorForm } from "#/testing/color-form.tsx";

describe("field.Select", () => {
  it("is named by its label, and focused and described by its error after a submit that fails", async () => {
    const submitted: Array<string> = [];
    await render(<ColorForm control="Select" onSubmit={(color) => submitted.push(color)} />);
    const select = page.getByRole("combobox", { name: "Color" });

    await page.getByRole("button", { name: "Save" }).click();

    await expect.element(select).toHaveFocus();
    await expect.element(select).toHaveAttribute("aria-invalid", "true");
    // ui-sdk's Field puts the error of a control it does not own ahead of the description: both are said.
    await expect.element(select).toHaveAccessibleDescription(/Your favorite\./);
    await expect.element(select).toHaveAccessibleDescription(/Choose a color/);
    expect(submitted).toEqual([]);

    await select.click();
    await page.getByRole("option", { name: "Blue" }).click();

    await expect.poll(() => select.element().textContent).toContain("Blue");
    await expect.element(select).toBeValid();
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => submitted).toEqual(["blue"]);
  });

  it("stays quiet when its list is closed without a choice, before any submit", async () => {
    await render(<ColorForm control="Select" />);
    const select = page.getByRole("combobox", { name: "Color" });

    await select.click();
    await userEvent.keyboard("{Escape}");

    await expect.element(select).not.toHaveAttribute("aria-invalid", "true");
    await expect.element(select).toHaveAccessibleDescription("Your favorite.");
  });

  it("empties a field that may stay empty with its none option", async () => {
    const submitted: Array<string | null> = [];
    await render(
      <OptionalColorForm
        control="Select"
        initial="blue"
        onSubmit={(color) => submitted.push(color)}
      />,
    );
    const select = page.getByRole("combobox", { name: "Color" });

    await select.click();
    await page.getByRole("option", { name: "No color" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => submitted).toEqual([null]);
  });
});
