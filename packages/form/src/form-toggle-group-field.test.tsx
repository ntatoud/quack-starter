import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DaysForm } from "#/testing/days-form.tsx";

describe("field.ToggleGroup", () => {
  it("is a group named by its label, its options named in full and described by its description", async () => {
    await render(<DaysForm onSubmit={() => {}} />);

    const tuesday = page
      .getByRole("group", { name: "Days" })
      .getByRole("button", { name: "Tuesday" });

    await expect.element(tuesday).toHaveTextContent("T");
    await expect.element(tuesday).toHaveAccessibleDescription("When you are in.");
  });

  it("submits the options pressed, in their order", async () => {
    const submitted: Array<ReadonlyArray<string>> = [];
    await render(<DaysForm onSubmit={(days) => submitted.push(days)} />);

    await page.getByRole("button", { name: "Wednesday" }).click();
    await page.getByRole("button", { name: "Monday" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => submitted).toEqual([["mon", "wed"]]);
  });

  it("focuses its first option on an error, which describes it", async () => {
    await render(<DaysForm onSubmit={() => {}} />);

    await page.getByRole("button", { name: "Save" }).click();

    const monday = page.getByRole("button", { name: "Monday" });
    await expect.element(monday).toHaveFocus();
    await expect.element(monday).toHaveAttribute("aria-invalid", "true");
    await expect.element(monday).toHaveAccessibleDescription("When you are in. Choose a day");
  });
});
