import { Schema, SchemaTransformation } from "effect";

import type { FieldOption } from "#/field-option.ts";
import { schemaFormOptions } from "#/schema-form-options.ts";
import { useAppForm } from "#/use-app-form.ts";

const ColorLiteral = Schema.Literals(["red", "blue", "green"]);

const Color = Schema.Struct({
  color: Schema.String.pipe(Schema.decodeTo(ColorLiteral.annotate({ message: "Choose a color" }))),
});

const OptionalColor = Schema.Struct({
  color: Schema.String.pipe(
    Schema.decodeTo(
      Schema.NullOr(Schema.String),
      SchemaTransformation.transform<string | null, string>({
        decode: (color) => (color === "" ? null : color),
        encode: (color) => color ?? "",
      }),
    ),
    Schema.decodeTo(Schema.NullOr(ColorLiteral)),
  ),
});

const decodeOptionalColor = Schema.decodeSync(OptionalColor);

const colors: ReadonlyArray<FieldOption> = [
  { value: "red", label: "Red" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
];

const ignore = () => {};

export function ColorForm({
  control,
  onSubmit = ignore,
}: {
  control: "Select" | "Combobox";
  onSubmit?: (color: string) => void;
}) {
  const form = useAppForm({
    ...schemaFormOptions(Color, { color: "" }),
    onSubmit: ({ value }) => onSubmit(value.color),
  });

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
        <form.AppField name="color">
          {(field) => (
            <field.Root>
              <field.Label>Color</field.Label>
              <field.Description>Your favorite.</field.Description>
              {control === "Select" ? (
                <field.Select options={colors} placeholder="Choose a color" />
              ) : (
                <field.Combobox options={colors} placeholder="Search a color" />
              )}
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}

/** A form of a color that may stay empty: `field.Select` offers "No color", `field.Combobox` a Clear button. */
export function OptionalColorForm({
  control,
  initial = "",
  onSubmit,
}: {
  control: "Select" | "Combobox";
  initial?: string;
  onSubmit: (color: string | null) => void;
}) {
  const form = useAppForm({
    ...schemaFormOptions(OptionalColor, { color: initial }),
    onSubmit: ({ value }) => onSubmit(decodeOptionalColor(value).color),
  });

  return (
    <form.AppForm>
      <form.Root className="flex w-80 flex-col gap-2 p-4">
        <form.AppField name="color">
          {(field) => (
            <field.Root>
              <field.Label>Color</field.Label>
              {control === "Select" ? (
                <field.Select options={colors} placeholder="Choose a color" noneLabel="No color" />
              ) : (
                <field.Combobox options={colors} placeholder="Search a color" clearable />
              )}
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
