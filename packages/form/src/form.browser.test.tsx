import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SubmitFailed } from "#/submit-failed.ts";
import { NameForm } from "#/testing/name-form.tsx";

describe("form.Root", () => {
  it("says the error of the focused field when Enter is pressed in it", async () => {
    await render(<NameForm />);
    const input = page.getByRole("textbox", { name: "Name" });

    await input.click();
    await userEvent.keyboard("{Enter}");

    // The focus has nowhere to move, so the live region says what the field's description would.
    await expect.element(page.getByRole("status")).toHaveTextContent("Name is required");
    await expect.element(input).toHaveFocus();

    await userEvent.keyboard("A");
    await expect.element(page.getByRole("status")).toHaveTextContent("");
  });

  it("moves the focus to the invalid field when the submit comes from elsewhere", async () => {
    await render(<NameForm />);

    await page.getByRole("button", { name: "Save" }).click();

    await expect.element(page.getByRole("textbox", { name: "Name" })).toHaveFocus();
    // The field describes itself on focus: saying it again would repeat it.
    await expect.element(page.getByRole("status")).toHaveTextContent("");
  });

  it("shows and says why a submit failed, and leaves the focus where it is", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new SubmitFailed("Could not save. Try again."));
    await render(<NameForm onSubmit={onSubmit} />);
    const save = page.getByRole("button", { name: "Save" });

    await page.getByRole("textbox", { name: "Name" }).fill("Ada");
    await save.click();

    await expect.element(page.getByRole("status")).toHaveTextContent("Could not save. Try again.");
    await expect.element(page.getByText("Could not save. Try again.").first()).toBeVisible();
    await expect.element(save).toHaveFocus();
  });
});
