import { useStore } from "@tanstack/react-form";
import { useId } from "react";

import { useFieldContext } from "#/context.ts";
import { useFormFieldLayout } from "#/form-field.tsx";
import { toMessage } from "#/messages.ts";

/**
 * What a field component wires to its control: the field of its `form.AppField`, the id and size of its `field.Root`
 * (its own id and `md` on its own), and its errors, shown once the field is touched; a submit touches every field.
 * `describedBy` names its `field.Description`, then its errors while they show.
 */
export function useFieldControl<Value = string>() {
  const field = useFieldContext<Value>();
  const meta = useStore(field.store, (state) => state.meta);
  const ownId = useId();
  const layout = useFormFieldLayout();
  const id = layout?.id ?? ownId;
  const size = layout?.size ?? "md";
  const errorId = `${id}-error`;
  const invalid = meta.isTouched && !meta.isValid;
  const describedBy = [
    layout?.hasDescription ? layout.descriptionId : null,
    invalid ? errorId : null,
  ].filter((part) => part !== null);

  return {
    field,
    id,
    size,
    errorId,
    invalid,
    describedBy: describedBy.length === 0 ? undefined : describedBy.join(" "),
    errors: meta.errors.map(toMessage),
  };
}
