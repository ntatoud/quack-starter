import * as React from "react";
import {
  SegmentedControl as SegmentedControlPrimitive,
  SegmentedControlIndicator,
  SegmentedControlItem as SegmentedControlItemPrimitive,
} from "@ui-sdk/react/segmented-control";
import { cn } from "cn";

// The indicator is built in, not a part to compose: every control of the app slides one to its checked item.
function SegmentedControl<T extends string = string>({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SegmentedControlPrimitive<T>>, "className" | "children"> & {
  className?: string | undefined;
  children?: React.ReactNode;
}) {
  return (
    <SegmentedControlPrimitive<T>
      className={cn(
        "relative isolate inline-flex w-fit items-center rounded-lg bg-muted inset-shadow-sunken p-[3px] text-muted-foreground data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className,
      )}
      {...props}
    >
      <SegmentedControlIndicator className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-md bg-background shadow-raised [--depth:2px] transition-[top,left,width,height] duration-200 ease-out data-[activation-direction=none]:transition-none motion-reduce:transition-none dark:border dark:border-input dark:bg-input/30" />
      {children}
    </SegmentedControlPrimitive>
  );
}

function SegmentedControlItem({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SegmentedControlItemPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <SegmentedControlItemPrimitive
      className={cn(
        "inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
