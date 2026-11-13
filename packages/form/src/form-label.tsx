import { FieldLabel } from "@quack/ui/components/field";
import { cn } from "@quack/ui/lib/utils";
import type { ComponentProps } from "react";

import { useFormFieldLayout } from "#/form-field.tsx";
import { textSize } from "#/size.ts";

export function FormLabel({
  className,
  ...props
}: Omit<ComponentProps<typeof FieldLabel>, "htmlFor">) {
  const layout = useFormFieldLayout();
  if (layout === null) throw new Error("field.Label must be rendered in a field.Root");

  return (
    <FieldLabel {...props} htmlFor={layout.id} className={cn(textSize[layout.size], className)} />
  );
}
