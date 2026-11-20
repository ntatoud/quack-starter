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
        items={options.map((option) => option.value)}
        itemToStringLabel={(value: string) => labels.get(value) ?? value}
        // Base UI calls `null` the value the field holds as `""`: nothing chosen.
        value={field.state.value === "" ? null : field.state.value}
        onValueChange={(value: string | null) => field.handleChange(value ?? "")}
      >
        <ComboboxInput
          id={id}
          name={field.name}
          placeholder={placeholder}
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
            {(value: string) => (
              <ComboboxItem key={value} value={value}>
                {labels.get(value) ?? value}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldControlError control={control} />
    </>
  );
}
