import { Field as UiField } from "@quack/ui/components/field";
import { useStore } from "@tanstack/react-form";
import { type ComponentProps, createContext, use, useId, useMemo } from "react";

import { useFieldContext } from "#/lib/form/context.ts";
import type { Size } from "#/lib/form/Size.ts";

/** What the parts of one field share: the id that ties the label to the control, and their size. */
type FieldLayout = { id: string; size: Size };

const FieldLayoutContext = createContext<FieldLayout | null>(null);

/** The layout of the enclosing `field.Field`, or `null` for a control used on its own. */
export const useFieldLayout = () => use(FieldLayoutContext);

/**
 * The frame of the field of its `form.AppField`: compose in it the label, the control, and what else the field shows.
 * It sets their `size`, and marks itself invalid once the field is touched and invalid.
 */
export function Field({
  size = "md",
  ...props
}: { size?: Size } & Omit<ComponentProps<typeof UiField>, "role" | "data-invalid">) {
  const field = useFieldContext();
  const invalid = useStore(field.store, (state) => state.meta.isTouched && !state.meta.isValid);
  // Not the field name: two forms on one page may both have a `title`.
  const id = useId();
  const layout = useMemo(() => ({ id, size }), [id, size]);

  return (
    <FieldLayoutContext value={layout}>
      {/* One labelled control is not a group. */}
      <UiField {...props} role={undefined} data-invalid={invalid} />
    </FieldLayoutContext>
  );
}
