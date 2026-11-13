import { Field } from "@quack/ui/components/field";
import { useStore } from "@tanstack/react-form";
import { type ComponentProps, createContext, use, useId, useMemo } from "react";

import { useFieldContext } from "#/context.ts";
import type { Size } from "#/size.ts";

type FieldLayout = { id: string; size: Size };

const FieldLayoutContext = createContext<FieldLayout | null>(null);

export const useFormFieldLayout = () => use(FieldLayoutContext);

export function FormField({
  size = "md",
  ...props
}: { size?: Size } & Omit<ComponentProps<typeof Field>, "role" | "data-invalid">) {
  const field = useFieldContext();
  const invalid = useStore(field.store, (state) => state.meta.isTouched && !state.meta.isValid);
  // Not the field name: two forms on one page may both have a `title`.
  const id = useId();
  const layout = useMemo(() => ({ id, size }), [id, size]);

  return (
    <FieldLayoutContext value={layout}>
      {/* One labelled control is not a group. */}
      <Field {...props} role={undefined} data-invalid={invalid} />
    </FieldLayoutContext>
  );
}
