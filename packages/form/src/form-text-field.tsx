import { Input } from "@quack/ui/components/input";
import type { ComponentProps } from "react";

import { FieldControlError } from "#/field-control-error.tsx";
import { useFieldControl } from "#/use-field-control.ts";

export function FormTextField(
  props: Omit<
    ComponentProps<typeof Input>,
    | "id"
    | "name"
    | "size"
    | "value"
    | "defaultValue"
    | "onValueChange"
    | "controller"
    | "onBlur"
    | "aria-invalid"
    | "aria-describedby"
  >,
) {
  const control = useFieldControl();
  const { field, id, size, invalid, describedBy } = control;

  return (
    <>
      <Input
        {...props}
        id={id}
        name={field.name}
        size={size}
        value={field.state.value}
        onValueChange={field.handleChange}
        onBlur={field.handleBlur}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <FieldControlError control={control} />
    </>
  );
}
