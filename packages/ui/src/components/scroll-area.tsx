import * as React from "react";
import {
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaCorner,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import { cn } from "cn";

function ScrollArea({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof ScrollAreaPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <ScrollAreaPrimitive className={cn("relative", className)} {...props}>
      <ScrollAreaViewport className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1">
        {children}
      </ScrollAreaViewport>
      <ScrollBar />
      <ScrollAreaCorner />
    </ScrollAreaPrimitive>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  autoHide = false,
  ...props
}: Omit<React.ComponentProps<typeof ScrollAreaScrollbar>, "className"> & {
  className?: string | undefined;
  /** Shows only while the pointer is over the area or it scrolls. */
  autoHide?: boolean;
}) {
  return (
    <ScrollAreaScrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-l-transparent",
        autoHide &&
          "opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100 motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
