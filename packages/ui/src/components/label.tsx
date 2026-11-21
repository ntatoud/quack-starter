import * as React from "react";
import { Label as LabelPrimitive } from "@ui-sdk/react/label";
import { cn } from "cn";

const labelClassName =
  "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-disabled:pointer-events-none group-data-disabled:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

function Label({
  className,
  ...props
}: Omit<React.ComponentProps<typeof LabelPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return <LabelPrimitive className={cn(labelClassName, className)} {...props} />;
}

export { Label, labelClassName };
