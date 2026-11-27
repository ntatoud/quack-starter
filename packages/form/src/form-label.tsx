import { FieldLabel } from "@quack/ui/components/field";
import { cn } from "@quack/ui/lib/utils";
import type { ComponentProps } from "react";

import { useRequiredFieldLayout } from "#/form-field.tsx";
import { textSize } from "#/size.ts";

export const labelIdOf = (fieldId: string) => `${fieldId}-label`;

export function FormLabel({
  className,
  ...props
}: Omit<ComponentProps<typeof FieldLabel>, "htmlFor" | "id">) {
  const layout = useRequiredFieldLayout("field.Label");

  return (
    <FieldLabel
      {...props}
      id={labelIdOf(layout.id)}
      htmlFor={layout.id}
      className={cn(textSize[layout.size], className)}
    />
  );
}
