import { Schema } from "effect";

import { schemaFormOptions } from "#/schema-form-options.ts";
import { useAppForm } from "#/use-app-form.ts";

const Passwords = Schema.Struct({
  password: Schema.String,
  confirmation: Schema.String,
}).check(
  Schema.makeFilter(({ password, confirmation }) => password === confirmation, {
    message: "Passwords must match",
  }),
);

const ignore = () => {};

/** A form whose schema has an issue of the form itself, not of one field: the two passwords differ. */
export function PasswordsForm({
  onSubmit = ignore,
  password = "",
}: {
  onSubmit?: () => void | Promise<void>;
  password?: string;
}) {
  const form = useAppForm({
    ...schemaFormOptions(Passwords, { password, confirmation: "" }),
    onSubmit,
  });

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
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
