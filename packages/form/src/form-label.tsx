import { FieldLabel } from "@quack/ui/components/field";
import { cn } from "@quack/ui/lib/utils";
import type { ComponentProps } from "react";

import { useRequiredFieldLayout } from "#/form-field.tsx";
import { textSize } from "#/size.ts";

export function FormLabel({
  className,
  ...props
}: Omit<ComponentProps<typeof FieldLabel>, "htmlFor">) {
  const layout = useRequiredFieldLayout("field.Label");

  return (
    // oxlint-disable-next-line shadcn/require-static-classes -- the linter reads no import; textSize is a map of static classes
    <FieldLabel {...props} htmlFor={layout.id} className={cn(textSize[layout.size], className)} />
  );
}
