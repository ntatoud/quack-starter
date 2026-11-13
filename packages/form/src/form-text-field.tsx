import { FieldError } from "@quack/ui/components/field";
import { Input } from "@quack/ui/components/input";
import type { ComponentProps } from "react";

import { textSize } from "#/size.ts";
import { useFieldControl } from "#/use-field-control.ts";

export function FormTextField(
  props: Omit<
    ComponentProps<typeof Input>,
    | "id"
    | "name"
    | "size"
    | "value"
    | "defaultValue"
    | "onChange"
    | "onBlur"
    | "aria-invalid"
    | "aria-describedby"
  >,
) {
  const { field, id, size, errorId, invalid, errors } = useFieldControl();

  return (
    <>
      <Input
        {...props}
        id={id}
        name={field.name}
        size={size}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid && (
        // Not an alert: the input describes itself with the error, and an alert would interrupt typing.
        <FieldError id={errorId} role={undefined} className={textSize[size]} errors={errors} />
      )}
    </>
  );
}
