import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@quack/ui/components/combobox";

import type { FieldOption } from "#/field-option.ts";
import { FieldControlError } from "#/field-control-error.tsx";
import { useFieldControl } from "#/use-field-control.ts";

export function FormComboboxField({
  options,
  placeholder,
  empty = "Nothing found.",
  clearable = false,
}: {
  options: ReadonlyArray<FieldOption>;
  placeholder?: string;
  empty?: string;
  /** Shows a button that empties the field, for a field that may stay empty. */
  clearable?: boolean;
}) {
  const control = useFieldControl();
  const { field, id, size, invalid, describedBy } = control;

  const labels = new Map(options.map((option) => [option.value, option.label]));

  return (
    <>
      <Combobox
        // The list is closed until opened: the input still shows the label of the value.
        itemToLabel={(value) => labels.get(value) ?? value}
        // ui-sdk calls `null` the value of nothing chosen, which the field holds as `""`.
        value={field.state.value === "" ? null : field.state.value}
        onValueChange={(value) => field.handleChange(value ?? "")}
        name={field.name}
      >
        <ComboboxInput
          id={id}
          {...(placeholder === undefined ? {} : { placeholder })}
          showClear={clearable && field.state.value !== ""}
          size={size}
          className="w-full"
          onBlur={field.handleBlur}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        <ComboboxContent>
          <ComboboxEmpty>{empty}</ComboboxEmpty>
          <ComboboxList>
            {options.map((option) => (
              <ComboboxItem key={option.value} value={option.value} label={option.label}>
                {option.label}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldControlError control={control} />
    </>
  );
}
