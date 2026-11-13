import { FieldError } from "@quack/ui/components/field";
import { Input } from "@quack/ui/components/input";
import { useStore } from "@tanstack/react-form";
import { type ComponentProps, useId } from "react";

import { useFieldContext } from "#/context.ts";
import { useFormFieldLayout } from "#/form-field.tsx";
import { toMessage } from "#/messages.ts";
import { textSize } from "#/size.ts";

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
  const field = useFieldContext<string>();
  const meta = useStore(field.store, (state) => state.meta);
  const ownId = useId();
  const { id, size } = useFormFieldLayout() ?? { id: ownId, size: "md" };
  const errorId = `${id}-error`;
  const invalid = meta.isTouched && !meta.isValid;

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
        <FieldError
          id={errorId}
          role={undefined}
          className={textSize[size]}
          errors={meta.errors.map(toMessage)}
        />
      )}
    </>
  );
}
