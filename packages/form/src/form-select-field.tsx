import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quack/ui/components/select";
import { cn } from "@quack/ui/lib/utils";

import type { FieldOption } from "#/field-option.ts";
import { textSize } from "#/size.ts";
import { FieldControlError } from "#/field-control-error.tsx";
import { useFieldControl } from "#/use-field-control.ts";

/** Over a dozen options, prefer `field.Combobox`, which searches them. */
export function FormSelectField({
  options,
  placeholder,
  noneLabel,
}: {
  options: ReadonlyArray<FieldOption>;
  placeholder?: string;
  /** The option that chooses nothing, for a field that may stay empty. */
  noneLabel?: string;
}) {
  const control = useFieldControl();
  const { field, id, size, invalid, describedBy } = control;

  return (
    <>
      <Select
        items={noneLabel === undefined ? options : [{ value: null, label: noneLabel }, ...options]}
        // Base UI calls `null` the value the field holds as `""`: nothing chosen.
        value={field.state.value === "" ? null : field.state.value}
        onValueChange={(value: string | null) => field.handleChange(value ?? "")}
        // The trigger loses the focus to the list it opens: the field is touched when the list closes.
        onOpenChange={(open) => open || field.handleBlur()}
      >
        <SelectTrigger
          id={id}
          name={field.name}
          size={size}
          // As tall a text as an input next to it, which is 16px on a small screen.
          className={cn("w-full", textSize[size], "max-md:text-base")}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {noneLabel !== undefined && <SelectItem value={null}>{noneLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldControlError control={control} />
    </>
  );
}
