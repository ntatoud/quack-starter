import { FieldLabel } from "@quack/ui/components/field";
import { cn } from "@quack/ui/lib/utils";
import type { ComponentProps } from "react";

import { useFieldLayout } from "#/lib/form/Field.tsx";
import { textSize } from "#/lib/form/Size.ts";

/**
 * The label of the control of its `field.Field`. Place it where the layout wants it: above the control, beside it,
 * or hidden with `className="sr-only"` when the screen already says what the control is for.
 */
export function Label({ className, ...props }: Omit<ComponentProps<typeof FieldLabel>, "htmlFor">) {
  const layout = useFieldLayout();
  if (layout === null) throw new Error("field.Label must be rendered in a field.Field");

  return (
    <FieldLabel {...props} htmlFor={layout.id} className={cn(textSize[layout.size], className)} />
  );
}
