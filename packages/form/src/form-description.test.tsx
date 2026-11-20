import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { schemaFormOptions } from "#/schema-form-options.ts";
import { useAppForm } from "#/use-app-form.ts";

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
