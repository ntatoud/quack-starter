import { Field } from "@quack/ui/components/field";
import { useStore } from "@tanstack/react-form";
import { type ComponentProps, createContext, use, useId, useMemo, useState } from "react";

import { useFieldContext } from "#/context.ts";
import type { Size } from "#/size.ts";

type FieldLayout = {
  id: string;
  size: Size;
  descriptionId: string;
  hasDescription: boolean;
  setHasDescription: (has: boolean) => void;
};

const FieldLayoutContext = createContext<FieldLayout | null>(null);

export const useFormFieldLayout = () => use(FieldLayoutContext);

/** The layout of the `field.Root` around a part that has no meaning outside it, such as its label. */
export const useRequiredFieldLayout = (part: string) => {
  const layout = use(FieldLayoutContext);
  if (layout === null) throw new Error(`${part} must be rendered in a field.Root`);
  return layout;
};

export function FormField({
  size = "md",
  ...props
}: { size?: Size } & Omit<ComponentProps<typeof Field>, "role" | "name" | "invalid">) {
  const field = useFieldContext();
  const invalid = useStore(field.store, (state) => state.meta.isTouched && !state.meta.isValid);
  // Not the field name: two forms on one page may both have a `title`.
  const id = useId();
  // The control names its description only once it is rendered: a reference to no element describes nothing.
  const [hasDescription, setHasDescription] = useState(false);
  const layout = useMemo(
    () => ({ id, size, descriptionId: `${id}-description`, hasDescription, setHasDescription }),
    [id, size, hasDescription],
  );

  return (
    <FieldLayoutContext value={layout}>
      {/* One labelled control is not a group. */}
      <Field {...props} role={undefined} name={field.name} invalid={invalid} />
    </FieldLayoutContext>
  );
}
