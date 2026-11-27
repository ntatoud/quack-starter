import { ToggleGroup, ToggleGroupItem } from "@quack/ui/components/toggle-group";

import type { FieldOption } from "#/field-option.ts";
import { FieldControlError } from "#/field-control-error.tsx";
import { labelIdOf } from "#/form-label.tsx";
import { useFieldControl } from "#/use-field-control.ts";

/** Several options pressed at once, of a field holding their values in the order of `options`. */
export function FormToggleGroupField({
  options,
}: {
  /** `short` is drawn in place of the label, which names the option still. */
  options: ReadonlyArray<FieldOption & { readonly short?: string }>;
}) {
  const control = useFieldControl<ReadonlyArray<string>>();
  const { field, id, invalid, describedBy } = control;

  return (
    <>
      <ToggleGroup
        id={id}
        multiple
        value={[...field.state.value]}
        onValueChange={(values) => {
          field.handleChange(values);
          field.handleBlur();
        }}
        // A label names a group only by reference: `for` points at a control it can focus.
        aria-labelledby={labelIdOf(id)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        {options.map(({ value, label, short }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            name={field.name}
            {...(short === undefined ? {} : { "aria-label": label })}
          >
            {short ?? label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FieldControlError control={control} />
    </>
  );
}
