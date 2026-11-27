import * as React from "react";
import { Toggle, ToggleGroup as ToggleGroupPrimitive } from "@ui-sdk/react/toggle";
import { cn } from "cn";

function ToggleGroup<T extends string = string>({
  className,
  ...props
}: Omit<React.ComponentProps<typeof ToggleGroupPrimitive<T>>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <ToggleGroupPrimitive<T>
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-lg aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

function ToggleGroupItem({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Toggle>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <Toggle
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input px-2 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-50 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground dark:bg-input/30 dark:data-pressed:bg-primary",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
