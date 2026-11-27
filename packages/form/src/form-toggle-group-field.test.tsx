import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DaysForm } from "#/testing/days-form.tsx";

describe("field.ToggleGroup", () => {
  it("is a group named by its label and described by its description, its options named in full", async () => {
    await render(<DaysForm onSubmit={() => {}} />);

    const group = page.getByRole("group", { name: "Days" });

    await expect.element(group).toHaveAccessibleDescription("When you are in.");
    await expect.element(group.getByRole("button", { name: "Tuesday" })).toHaveTextContent("T");
  });

  it("submits the options pressed, in their order", async () => {
    const submitted: Array<ReadonlyArray<string>> = [];
    await render(<DaysForm onSubmit={(days) => submitted.push(days)} />);

    await page.getByRole("button", { name: "Wednesday" }).click();
    await page.getByRole("button", { name: "Monday" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => submitted).toEqual([["mon", "wed"]]);
  });

  it("reports its error on the group", async () => {
    await render(<DaysForm onSubmit={() => {}} />);

    await page.getByRole("button", { name: "Save" }).click();

    const group = page.getByRole("group", { name: "Days" });
    await expect.element(group).toHaveAttribute("aria-invalid", "true");
    await expect.element(group).toHaveAccessibleDescription("When you are in. Choose a day");
  });
});
