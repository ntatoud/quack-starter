import { Schema } from "effect";

import { schemaFormOptions } from "#/schema-form-options.ts";
import { useAppForm } from "#/use-app-form.ts";

const Days = Schema.Struct({
  days: Schema.Array(Schema.String).check(Schema.isMinLength(1, { message: "Choose a day" })),
});

const days = [
  { value: "mon", label: "Monday", short: "M" },
  { value: "tue", label: "Tuesday", short: "T" },
  { value: "wed", label: "Wednesday", short: "W" },
];

export function DaysForm({ onSubmit }: { onSubmit: (days: ReadonlyArray<string>) => void }) {
  const form = useAppForm({
    ...schemaFormOptions(Days, { days: [] }),
    onSubmit: ({ value }) => onSubmit(value.days),
  });

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
        <form.AppField name="days">
          {(field) => (
            <field.Root>
              <field.Label>Days</field.Label>
              <field.Description>When you are in.</field.Description>
              <field.ToggleGroup options={days} />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
