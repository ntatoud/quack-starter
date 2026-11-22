"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipArrow as TooltipArrowPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { cn } from "cn";

function TooltipContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TooltipContentPrimitive>, "className" | "children"> & {
  className?: string | undefined;
  children?: React.ReactNode;
}) {
  return (
    <TooltipContentPrimitive
      className={cn(
        "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background transition-[opacity,scale] duration-100 has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipArrowPrimitive className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
    </TooltipContentPrimitive>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
