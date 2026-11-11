// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { schemaFormOptions } from "#/lib/form/schemaFormOptions.ts";
import { SubmitFailed } from "#/lib/form/SubmitFailed.ts";
import { useAppForm } from "#/lib/form/useAppForm.ts";

const Passwords = Schema.Struct({
  password: Schema.String,
  confirmation: Schema.String,
}).check(
  Schema.makeFilter(({ password, confirmation }) => password === confirmation, {
    message: "Passwords must match",
  }),
);

type OnSubmit = () => void | Promise<void>;

function PasswordsForm({ onSubmit, password }: { onSubmit: OnSubmit; password: string }) {
  const form = useAppForm({
    ...schemaFormOptions(Passwords, { password, confirmation: "" }),
    onSubmit,
  });
  return (
    <form.AppForm>
      <form.Root>
        <form.AppField name="password">
          {(field) => (
            <field.Root>
              <field.Label>Password</field.Label>
              <field.Text />
            </field.Root>
          )}
        </form.AppField>
        <form.AppField name="confirmation">
          {(field) => (
            <field.Root>
              <field.Label>Confirmation</field.Label>
              <field.Text />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Save</form.SubmitButton>
        <button type="button" onClick={() => form.reset()}>
          Clear
        </button>
      </form.Root>
    </form.AppForm>
  );
}

const setup = (onSubmit: OnSubmit, { password = "" } = {}) => {
  render(<PasswordsForm onSubmit={onSubmit} password={password} />);
  return { user: userEvent.setup(), save: screen.getByRole("button", { name: "Save" }) };
};

/** The error as shown, apart from the live region that says it. */
const shown = (text: string) => screen.queryByText(text, { ignore: '[role="status"]' });

/** Every text the live region held, in order. */
const announcements = () => {
  const region = screen.getByRole("status");
  const texts: Array<string> = [];
  new MutationObserver(() => texts.push(region.textContent)).observe(region, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return texts;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Form", () => {
  it("shows an issue of the form itself, and says it at each submit", async () => {
    const onSubmit = vi.fn();
    const { user, save } = setup(onSubmit);
    const said = announcements();

    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(save);
    await vi.waitFor(() => expect(said).toEqual(["Passwords must match"]));
    await user.click(save);
    await vi.waitFor(() =>
      expect(said).toEqual(["Passwords must match", "", "Passwords must match"]),
    );

    expect(shown("Passwords must match")).not.toBeNull();
    // Not an alert: it comes and goes while the user types the confirmation.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not say an error again when the form is reset to the values it was about", async () => {
    // The default values are invalid, and a reset brings back those very values.
    const { user } = setup(vi.fn(), { password: "secret" });
    const password = screen.getByLabelText("Password");
    const said = announcements();

    await user.type(password, "{Enter}");
    await vi.waitFor(() => expect(said).toEqual(["Passwords must match"]));
    await user.type(password, "!");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(password).toHaveProperty("value", "secret");
    expect(said).toEqual(["Passwords must match", ""]);
  });

  it("says nothing after a success, even when the form became invalid during the request", async () => {
    const response = Promise.withResolvers<void>();
    const { user, save } = setup(() => response.promise);
    const said = announcements();

    await user.click(save);
    await user.type(screen.getByLabelText("Password"), "a");
    response.resolve();

    await vi.waitFor(() => expect(save.getAttribute("aria-disabled")).toBe("false"));
    expect(said).toEqual([]);
    expect(document.activeElement).not.toBe(screen.getByLabelText("Confirmation"));
  });

  it("shows and says the message of a SubmitFailed, until the next edit", async () => {
    const { user, save } = setup(vi.fn().mockRejectedValue(new SubmitFailed("Could not save")));
    const said = announcements();

    await user.click(save);
    await vi.waitFor(() => expect(said).toEqual(["Could not save"]));
    expect(shown("Could not save")).not.toBeNull();

    await user.type(screen.getByLabelText("Password"), "s");
    expect(screen.queryByText("Could not save")).toBeNull();
  });

  it("reports any other error thrown by onSubmit", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const bug = new TypeError("bug");
    const { user, save } = setup(vi.fn().mockRejectedValue(bug));

    await user.click(save);

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith(bug));
    expect(screen.queryByText("bug")).toBeNull();
  });
});
