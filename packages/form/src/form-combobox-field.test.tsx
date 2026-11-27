import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ColorForm, OptionalColorForm } from "#/testing/color-form.tsx";

describe("field.Combobox", () => {
  it("opens a list about as wide as its control, not as the page", async () => {
    await page.viewport(1280, 800);
    await render(<ColorForm control="Combobox" />);
    const input = page.getByRole("combobox", { name: "Color" });

    await input.click();
    const listbox = page.getByRole("listbox");
    await expect.element(listbox).toBeVisible();

    // Polled: the list grows from 95% of its width as it opens.
    await expect
      .poll(() => listbox.element().getBoundingClientRect().width)
      .toBeGreaterThanOrEqual(input.element().getBoundingClientRect().width);
    expect(listbox.element().getBoundingClientRect().width).toBeLessThan(window.innerWidth / 2);
  });

  it("picks an option found by its label", async () => {
    const submitted: Array<string> = [];
    await render(<ColorForm control="Combobox" onSubmit={(color) => submitted.push(color)} />);
    const input = page.getByRole("combobox", { name: "Color" });

    await input.fill("gre");
    await expect.element(page.getByRole("option", { name: "Red" })).not.toBeInTheDocument();
    await page.getByRole("option", { name: "Green" }).click();

    await expect.element(input).toHaveValue("Green");
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => submitted).toEqual(["green"]);
  });

  it("is focused and described by its error after a submit that fails", async () => {
    await render(<ColorForm control="Combobox" />);
    const input = page.getByRole("combobox", { name: "Color" });

    await page.getByRole("button", { name: "Save" }).click();

    await expect.element(input).toHaveFocus();
    await expect.element(input).toBeInvalid();
    await expect.element(input).toHaveAccessibleDescription("Your favorite. Choose a color");

    await userEvent.keyboard("Blu");
    await page.getByRole("option", { name: "Blue" }).click();

    await expect.element(input).toBeValid();
  });

  it("empties a field that may stay empty with its Clear button", async () => {
    const submitted: Array<string | null> = [];
    await render(
      <OptionalColorForm
        control="Combobox"
        initial="green"
        onSubmit={(color) => submitted.push(color)}
      />,
    );

    await expect.element(page.getByRole("combobox", { name: "Color" })).toHaveValue("Green");
    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => submitted).toEqual([null]);
    await expect.element(page.getByRole("combobox", { name: "Color" })).toHaveValue("");
  });
});
