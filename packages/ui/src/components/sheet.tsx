"use client";

import * as React from "react";
import {
  Drawer as Sheet,
  DrawerBackdrop as SheetBackdropPrimitive,
  DrawerClose as SheetClose,
  DrawerContent as SheetContentPrimitive,
  DrawerDescription as SheetDescriptionPrimitive,
  DrawerTitle as SheetTitlePrimitive,
  DrawerTrigger as SheetTrigger,
} from "@ui-sdk/react/drawer";
import { cn } from "cn";

import { Button } from "@quack/ui/components/button";
import { XIcon } from "lucide-react";

/** The drawer slides itself from `side`, a prop of `Sheet`: the content leaves its position and translate to it. */
function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: Omit<React.ComponentProps<typeof SheetContentPrimitive>, "className" | "children"> & {
  className?: string | undefined;
  children?: React.ReactNode;
  showCloseButton?: boolean;
}) {
  return (
    <>
      <SheetBackdropPrimitive className="bg-black/10 supports-backdrop-filter:backdrop-blur-xs" />
      {/* `fixed` to the edges of the window, which `viewport-fit=cover` takes under the notch and the home indicator of
          an iPhone: the content keeps clear of them, on the sides the sheet touches. */}
      <SheetContentPrimitive
        className={cn(
          "flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-float data-[side=bottom]:h-auto data-[side=bottom]:w-full data-[side=bottom]:border-t data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:sm:max-w-sm data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:sm:max-w-sm data-[side=top]:h-auto data-[side=top]:w-full data-[side=top]:border-b pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] data-[side=left]:pl-[env(safe-area-inset-left)] data-[side=right]:pr-[env(safe-area-inset-right)] data-[side=bottom]:pt-0 data-[side=top]:pb-0",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetClose
            render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetClose>
        )}
      </SheetContentPrimitive>
    </>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SheetTitlePrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <SheetTitlePrimitive
      className={cn("font-heading text-base font-medium text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SheetDescriptionPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <SheetDescriptionPrimitive
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
