import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { SubmitFailed } from "#/submit-failed.ts";
import { NameForm } from "#/testing/name-form.tsx";
import { PasswordsForm } from "#/testing/passwords-form.tsx";

/** Every text the live region held, in order. */
const announcements = () => {
  const region = page.getByRole("status").element();
  const texts: Array<string> = [];
  new MutationObserver(() => texts.push(region.textContent)).observe(region, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return texts;
};

/** The error as shown, apart from the live region that says it. */
const shown = (text: string) =>
  page
    .getByText(text)
    .elements()
    .filter((element) => element.getAttribute("role") !== "status");

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("shows an issue of the form itself, and says it at each submit", async () => {
    const onSubmit = vi.fn();
    await render(<PasswordsForm onSubmit={onSubmit} />);
    const save = page.getByRole("button", { name: "Save" });
    const said = announcements();

    await page.getByRole("textbox", { name: "Password" }).fill("secret");
    await save.click();
    await expect.poll(() => said).toEqual(["Passwords must match"]);
    await save.click();
    await expect.poll(() => said).toEqual(["Passwords must match", "", "Passwords must match"]);

    expect(shown("Passwords must match")).toHaveLength(1);
    // Not an alert: it comes and goes while the user types the confirmation.
    expect(page.getByRole("alert").elements()).toEqual([]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not say an error again when the form is reset to the values it was about", async () => {
    // The default values are invalid, and a reset brings back those very values.
    await render(<PasswordsForm password="secret" />);
    const password = page.getByRole("textbox", { name: "Password" });
    const said = announcements();

    await password.click();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => said).toEqual(["Passwords must match"]);
    await userEvent.keyboard("!");
    await page.getByRole("button", { name: "Clear" }).click();

    await expect.element(password).toHaveValue("secret");
    expect(said).toEqual(["Passwords must match", ""]);
  });

  it("says nothing after a success, even when the form became invalid during the request", async () => {
    const response = Promise.withResolvers<void>();
    await render(<PasswordsForm onSubmit={() => response.promise} />);
    const save = page.getByRole("button", { name: "Save" });
    const said = announcements();

    await save.click();
    await page.getByRole("textbox", { name: "Password" }).fill("a");
    response.resolve();

    await expect.element(save).toHaveAttribute("aria-disabled", "false");
    expect(said).toEqual([]);
    await expect.element(page.getByRole("textbox", { name: "Password" })).toHaveFocus();
  });

  it("drops the message of a SubmitFailed on the next edit", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new SubmitFailed("Could not save"));
    await render(<PasswordsForm onSubmit={onSubmit} />);

    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => shown("Could not save")).toHaveLength(1);

    await page.getByRole("textbox", { name: "Password" }).fill("s");
    await expect.poll(() => page.getByText("Could not save").elements()).toEqual([]);
  });

  it("reports any other error thrown by onSubmit", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const bug = new TypeError("bug");
    await render(<PasswordsForm onSubmit={vi.fn().mockRejectedValue(bug)} />);

    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => reportError).toHaveBeenCalledWith(bug);
    expect(page.getByText("bug").elements()).toEqual([]);
  });
});
