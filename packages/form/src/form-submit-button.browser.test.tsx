import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { NameForm } from "#/testing/name-form.tsx";

describe("form.SubmitButton", () => {
  it("follows the field in the tab order, and submits with Enter", async () => {
    const onSubmit = vi.fn();
    await render(<NameForm onSubmit={onSubmit} />);

    await userEvent.tab();
    await userEvent.keyboard("Ada");
    await userEvent.tab();
    await expect.element(page.getByRole("button", { name: "Save" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps the focus and ignores every way to submit while the form submits", async () => {
    const response = Promise.withResolvers<void>();
    const onSubmit = vi.fn(() => response.promise);
    await render(<NameForm onSubmit={onSubmit} />);
    const input = page.getByRole("textbox", { name: "Name" });
    const save = page.getByRole("button", { name: "Save" });

    await input.fill("Ada");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    // A disabled button would lose the focus to the page; this one says it is unavailable and keeps it.
    await expect.element(save).toHaveAttribute("aria-disabled", "true");
    await expect.element(save).toHaveFocus();
    await expect.element(save).toHaveStyle({ opacity: "0.5" });

    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await save.click({ force: true });
    await input.click();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    response.resolve();
    await expect.element(save).toHaveAttribute("aria-disabled", "false");
    await expect.element(save).toHaveStyle({ opacity: "1" });
  });

  it("stays available while the form is invalid, so a submit can say why", async () => {
    await render(<NameForm />);
    const save = page.getByRole("button", { name: "Save" });

    await save.click();
    await expect.element(page.getByText("Name is required")).toBeVisible();

    await expect.element(save).toHaveAttribute("aria-disabled", "false");
  });
});
