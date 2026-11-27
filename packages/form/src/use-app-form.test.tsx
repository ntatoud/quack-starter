import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { FieldRefused } from "#/field-refused.ts";
import { schemaFormOptions } from "#/schema-form-options.ts";
import { SubmitFailed } from "#/submit-failed.ts";
import { ColorForm, OptionalColorForm } from "#/testing/color-form.tsx";
import { NameForm } from "#/testing/name-form.tsx";
import { PasswordsForm } from "#/testing/passwords-form.tsx";
import { ToggleForm } from "#/testing/toggle-form.tsx";
import { useAppForm } from "#/use-app-form.ts";

const height = (element: Element) => element.getBoundingClientRect().height;

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

const shown = (text: string) =>
  page
    .getByText(text)
    .elements()
    .filter((element) => element.getAttribute("role") !== "status");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("field.Root", () => {
  it.for([
    { size: "sm", pixels: 28 },
    { size: "md", pixels: 32 },
    { size: "lg", pixels: 36 },
  ] as const)("gives the control the height of a $size button", async ({ size, pixels }) => {
    await render(<NameForm size={size} />);

    expect(height(page.getByRole("textbox", { name: "Name" }).element())).toBe(pixels);
    expect(height(page.getByRole("button", { name: "Save" }).element())).toBe(pixels);
  });
});

describe("field.Label", () => {
  it("names the control, and focuses it when clicked", async () => {
    await render(<NameForm />);
    const input = page.getByRole("textbox", { name: "Name" });

    await page.getByText("Name").click();

    await expect.element(input).toHaveFocus();
  });

  it("still names the control when it is visually hidden", async () => {
    await render(<NameForm labelClassName="sr-only" />);

    await expect.element(page.getByRole("textbox", { name: "Name" })).toBeVisible();
    expect(height(page.getByText("Name").element())).toBe(1);
  });
});

const Name = Schema.Struct({
  name: Schema.String.check(Schema.isNonEmpty({ message: "Name is required" })),
});

function DescribedForm() {
  const form = useAppForm(schemaFormOptions(Name, { name: "" }));

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
        <form.AppField name="name">
          {(field) => (
            <field.Root>
              <field.Label>Name</field.Label>
              <field.Description>As others see it.</field.Description>
              <field.Text />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}

describe("field.Description", () => {
  it("describes the control, then the control's error after it", async () => {
    await render(<DescribedForm />);
    const input = page.getByRole("textbox", { name: "Name" });

    await expect.element(input).toHaveAccessibleDescription("As others see it.");

    await page.getByRole("button", { name: "Save" }).click();

    await expect.element(input).toHaveAccessibleDescription("As others see it. Name is required");
  });
});

const Search = Schema.Struct({ query: Schema.String });

function SearchForm() {
  const form = useAppForm(schemaFormOptions(Search, { query: "" }));

  return (
    <form.AppField name="query">{(field) => <field.Text aria-label="Search" />}</form.AppField>
  );
}

describe("field.Text", () => {
  it("is described by its error after a submit that fails, until it is valid again", async () => {
    await render(<NameForm />);
    const input = page.getByRole("textbox", { name: "Name" });

    await page.getByRole("button", { name: "Save" }).click();

    await expect.element(input).toHaveFocus();
    await expect.element(input).toBeInvalid();
    await expect.element(input).toHaveAccessibleDescription("Name is required");
    // The focused input says its error; an alert would say it twice.
    expect(page.getByRole("alert").elements()).toEqual([]);

    await userEvent.keyboard("Ada");

    await expect.element(input).toBeValid();
    await expect.element(input).toHaveAccessibleDescription("");
  });

  it("stays quiet about a field the user has not touched", async () => {
    await render(<NameForm />);
    const input = page.getByRole("textbox", { name: "Name" });

    await input.click();
    await userEvent.tab();

    await expect.element(input).toBeValid();
    await expect.element(page.getByText("Name is required")).not.toBeInTheDocument();
  });

  it("works without a field.Root, named by its aria-label", async () => {
    await render(<SearchForm />);
    const input = page.getByRole("textbox", { name: "Search" });

    await input.fill("forms");

    await expect.element(input).toHaveValue("forms");
  });
});

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

describe("field.Select", () => {
  it("opens a list as wide as its control, not as the page", async () => {
    await page.viewport(1280, 800);
    await render(<ColorForm control="Select" />);
    const select = page.getByRole("combobox", { name: "Color" });

    await select.click();
    const listbox = page.getByRole("listbox");
    await expect.element(listbox).toBeVisible();

    // Polled: the list grows from 95% of its width as it opens.
    await expect
      .poll(() => listbox.element().getBoundingClientRect().width)
      .toBe(select.element().getBoundingClientRect().width);
  });

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

describe("field.Switch", () => {
  it("is a switch named by its label and described by its description, in its state", async () => {
    await render(<ToggleForm initial onChange={() => {}} />);
    const toggle = page.getByRole("switch", { name: "Newsletter" });

    await expect.element(toggle).toBeChecked();
    await expect.element(toggle).toHaveAccessibleDescription("Once a month.");
  });

  it("turns on and off with a click or the keyboard", async () => {
    const changes: Array<boolean> = [];
    await render(<ToggleForm initial={false} onChange={(value) => changes.push(value)} />);
    const toggle = page.getByRole("switch", { name: "Newsletter" });

    await toggle.click();
    await expect.element(toggle).toBeChecked();
    await userEvent.keyboard(" ");

    await expect.element(toggle).not.toBeChecked();
    expect(changes).toEqual([true, false]);
  });

  it("turns on from a click on its label", async () => {
    await render(<ToggleForm initial={false} onChange={() => {}} />);

    await page.getByText("Newsletter", { exact: true }).click();

    await expect.element(page.getByRole("switch", { name: "Newsletter" })).toBeChecked();
  });
});

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
    await expect.element(save).not.toHaveAttribute("aria-disabled");
    await expect.element(save).toHaveStyle({ opacity: "1" });
  });

  it("stays available while the form is invalid, so a submit can say why", async () => {
    await render(<NameForm />);
    const save = page.getByRole("button", { name: "Save" });

    await save.click();
    await expect.element(page.getByText("Name is required")).toBeVisible();

    await expect.element(save).not.toHaveAttribute("aria-disabled");
  });
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

  it("shows a refusal of one field on that field, focuses it, and clears it on an edit", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new FieldRefused("name", "This name is taken."));
    await render(<NameForm onSubmit={onSubmit} />);
    const input = page.getByRole("textbox", { name: "Name" });

    await input.fill("Ada");
    await page.getByRole("button", { name: "Save" }).click();

    await expect.element(input).toHaveFocus();
    await expect.element(input).toHaveAttribute("aria-invalid", "true");
    await expect.element(input).toHaveAccessibleDescription("This name is taken.");

    await userEvent.keyboard("s");

    await expect.element(input).not.toHaveAttribute("aria-invalid", "true");
    expect(shown("This name is taken.")).toEqual([]);
  });

  it("says the refusal of the field Enter was pressed in", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new FieldRefused("name", "This name is taken."));
    await render(<NameForm onSubmit={onSubmit} />);
    const input = page.getByRole("textbox", { name: "Name" });

    await input.fill("Ada");
    await userEvent.keyboard("{Enter}");

    await expect.element(page.getByRole("status")).toHaveTextContent("This name is taken.");
    await expect.element(input).toHaveFocus();
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

    await expect.element(save).not.toHaveAttribute("aria-disabled");
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
