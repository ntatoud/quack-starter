import { useStore } from "@tanstack/react-form";
import { useId } from "react";

import { useFieldContext } from "#/context.ts";
import { useFormFieldLayout } from "#/form-field.tsx";
import { toMessage } from "#/messages.ts";

/**
 * What a field component wires to its control: the field of its `form.AppField`, the id and size of its `field.Root`
 * (its own id and `md` on its own), and its errors, shown once the field is touched; a submit touches every field.
 */
export function useFieldControl() {
  const field = useFieldContext<string>();
  const meta = useStore(field.store, (state) => state.meta);
  const ownId = useId();
  const { id, size } = useFormFieldLayout() ?? { id: ownId, size: "md" };

  return {
    field,
    id,
    size,
    errorId: `${id}-error`,
    invalid: meta.isTouched && !meta.isValid,
    errors: meta.errors.map(toMessage),
  };
}
