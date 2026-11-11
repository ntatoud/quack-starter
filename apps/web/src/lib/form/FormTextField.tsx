import { FieldError } from "@quack/ui/components/field";
import { Input } from "@quack/ui/components/input";
import { useStore } from "@tanstack/react-form";
import { type ComponentProps, useId } from "react";

import { useFieldContext } from "#/lib/form/context.ts";
import { useFormFieldLayout } from "#/lib/form/FormField.tsx";
import { toMessage } from "#/lib/form/messages.ts";
import { textSize } from "#/lib/form/Size.ts";

/**
 * A text input bound to the field of its `form.AppField`, followed by its errors.
 * Errors show once the field is touched; a submit touches every field.
 *
 * In a `field.Root` it takes the size of the field and the id its `field.Label` points to.
 * On its own, give it an `aria-label`.
 */
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
        // `Form` finds the invalid field by `aria-invalid`, and its errors by `name`.
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
