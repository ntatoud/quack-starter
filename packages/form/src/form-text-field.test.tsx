import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import { Schema } from "effect";

import { schemaFormOptions } from "#/schema-form-options.ts";
import { NameForm } from "#/testing/name-form.tsx";
import { useAppForm } from "#/use-app-form.ts";

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
