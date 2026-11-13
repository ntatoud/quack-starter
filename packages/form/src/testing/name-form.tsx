import { Schema } from "effect";

import { schemaFormOptions } from "#/schema-form-options.ts";
import type { Size } from "#/size.ts";
import { useAppForm } from "#/use-app-form.ts";

const Name = Schema.Struct({
  name: Schema.String.check(Schema.isNonEmpty({ message: "Name is required" })),
});

const ignore = () => {};

export function NameForm({
  onSubmit = ignore,
  size = "md",
  labelClassName,
}: {
  onSubmit?: () => void | Promise<void>;
  size?: Size;
  labelClassName?: string;
}) {
  const form = useAppForm({ ...schemaFormOptions(Name, { name: "" }), onSubmit });

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
        <form.AppField name="name">
          {(field) => (
            <field.Root size={size}>
              <field.Label className={labelClassName}>Name</field.Label>
              <field.Text />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton size={size}>Save</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
