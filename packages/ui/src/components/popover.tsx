"use client";

import * as React from "react";
import {
  Popover,
  PopoverClose,
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription as PopoverDescriptionPrimitive,
  PopoverTitle as PopoverTitlePrimitive,
  PopoverTrigger,
} from "@ui-sdk/react/popover";
import { cn } from "cn";

function PopoverContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof PopoverContentPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <PopoverContentPrimitive
      className={cn(
        "z-50 flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof PopoverTitlePrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return <PopoverTitlePrimitive className={cn("font-medium", className)} {...props} />;
}

function PopoverDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof PopoverDescriptionPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <PopoverDescriptionPrimitive className={cn("text-muted-foreground", className)} {...props} />
  );
}

export {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
