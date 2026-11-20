import { Schema } from "effect";

import { schemaFormOptions } from "#/schema-form-options.ts";
import { useAppForm } from "#/use-app-form.ts";

const Newsletter = Schema.Struct({ newsletter: Schema.Boolean });

export function ToggleForm({
  initial,
  onChange,
}: {
  initial: boolean;
  onChange: (newsletter: boolean) => void;
}) {
  const form = useAppForm({
    ...schemaFormOptions(Newsletter, { newsletter: initial }),
    listeners: { onChange: ({ formApi }) => onChange(formApi.state.values.newsletter) },
  });

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
        <form.AppField name="newsletter">
          {(field) => (
            <field.Root>
              <field.Label>Newsletter</field.Label>
              <field.Description>Once a month.</field.Description>
              <field.Switch />
            </field.Root>
          )}
        </form.AppField>
      </form.Root>
    </form.AppForm>
  );
}
