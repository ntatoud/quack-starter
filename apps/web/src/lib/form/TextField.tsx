import { Field, FieldError, FieldLabel } from "@quack/ui/components/field";
import { Input } from "@quack/ui/components/input";
import { useStore } from "@tanstack/react-form";
import { type ComponentProps, useId } from "react";

import { useFieldContext } from "#/lib/form/context.ts";
import { toMessage } from "#/lib/form/messages.ts";
import type { Size } from "#/lib/form/Size.ts";

const textSize = { sm: "text-[0.8rem]", md: "text-sm", lg: "text-sm" } satisfies Record<
  Size,
  string
>;

/**
 * A text input bound to the field of its `form.AppField`, with its label and errors.
 * Errors show once the field is touched; a submit touches every field.
 */
export function TextField({
  label,
  hideLabel = false,
  size = "md",
  ...props
}: { label: string; hideLabel?: boolean; size?: Size } & Omit<
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
>) {
  const field = useFieldContext<string>();
  const meta = useStore(field.store, (state) => state.meta);
  // Not the field name: two forms on one page may both have a `title`.
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = meta.isTouched && !meta.isValid;

  return (
    // One labelled input is not a group.
    <Field role={undefined} data-invalid={invalid}>
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : textSize[size]}>
        {label}
      </FieldLabel>
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
    </Field>
  );
}
