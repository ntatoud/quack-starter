import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ColorForm, OptionalColorForm } from "#/testing/color-form.tsx";

describe("field.Combobox", () => {
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
