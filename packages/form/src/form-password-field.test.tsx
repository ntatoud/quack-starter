import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { Schema } from "effect";

import { schemaFormOptions } from "#/schema-form-options.ts";
import { useAppForm } from "#/use-app-form.ts";

const Credentials = Schema.Struct({
  password: Schema.String.check(Schema.isNonEmpty({ message: "Password is required" })),
});

function PasswordForm() {
  const form = useAppForm(schemaFormOptions(Credentials, { password: "" }));

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
        <form.AppField name="password">
          {(field) => (
            <field.Root>
              <field.Label>Password</field.Label>
              <field.Password />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}

const passwordInput = () => page.getByLabelText("Password", { exact: true });

describe("field.Password", () => {
  it("hides the password until the toggle is pressed, and hides it again", async () => {
    await render(<PasswordForm />);
    const input = passwordInput();
    const toggle = page.getByRole("button", { name: "Show password" });

    await input.fill("secret");

    await expect.element(input).toHaveAttribute("type", "password");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();

    await expect.element(input).toHaveAttribute("type", "text");
    await expect.element(input).toHaveValue("secret");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "true");

    await toggle.click();

    await expect.element(input).toHaveAttribute("type", "password");
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("goes from the input to the toggle with the keyboard", async () => {
    await render(<PasswordForm />);

    await passwordInput().click();
    await userEvent.tab();

    await expect.element(page.getByRole("button", { name: "Show password" })).toHaveFocus();
  });

  it("is described by its error after a submit that fails, and takes the focus", async () => {
    await render(<PasswordForm />);
    const input = passwordInput();

    await page.getByRole("button", { name: "Save" }).click();

    await expect.element(input).toHaveFocus();
    await expect.element(input).toBeInvalid();
    await expect.element(input).toHaveAccessibleDescription("Password is required");
  });
});
