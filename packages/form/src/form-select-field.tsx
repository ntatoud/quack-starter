import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quack/ui/components/select";
import { cn } from "cn";

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
        items={
          noneLabel === undefined ? [...options] : [{ value: "", label: noneLabel }, ...options]
        }
        // ui-sdk calls `null` the value of nothing chosen. With a none option the field's `""` is that option's value.
        value={field.state.value === "" && noneLabel === undefined ? null : field.state.value}
        onValueChange={(value) => field.handleChange(value ?? "")}
        {...(placeholder === undefined ? {} : { placeholder })}
        name={field.name}
        // The trigger loses the focus to the list it opens: the field is touched when the list closes.
        onOpenChange={(open) => open || field.handleBlur()}
      >
        <SelectTrigger
          id={id}
          size={size}
          // As tall a text as an input next to it, which is 16px on a touch screen.
          // oxlint-disable-next-line shadcn/require-static-classes -- the linter reads no import; textSize is a map of static classes
          className={cn("w-full", textSize[size], "pointer-coarse:text-base")}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {noneLabel !== undefined && <SelectItem value="">{noneLabel}</SelectItem>}
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
