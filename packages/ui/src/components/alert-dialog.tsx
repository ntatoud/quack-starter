"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogBackdrop as AlertDialogBackdropPrimitive,
  AlertDialogClose,
  AlertDialogContent as AlertDialogContentPrimitive,
  AlertDialogDescription as AlertDialogDescriptionPrimitive,
  AlertDialogTitle as AlertDialogTitlePrimitive,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { cn } from "cn";

import { Button } from "@quack/ui/components/button";

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogContentPrimitive>, "className"> & {
  className?: string | undefined;
  size?: "default" | "sm";
}) {
  return (
    <>
      <AlertDialogBackdropPrimitive className="fixed inset-0 isolate z-50 bg-black/10 transition-opacity duration-100 supports-backdrop-filter:backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <AlertDialogContentPrimitive
        data-size={size}
        className={cn(
          "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 m-0 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border-0 bg-popover p-4 text-popover-foreground shadow-float ring-1 ring-foreground/10 outline-none transition-[opacity,scale] duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className,
        )}
        {...props}
      />
    </>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogTitlePrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <AlertDialogTitlePrimitive
      className={cn(
        "font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogDescriptionPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <AlertDialogDescriptionPrimitive
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Not a Close part: the caller decides when the dialog closes, such as once a request has succeeded. */
function AlertDialogAction({ ...props }: React.ComponentProps<typeof Button>) {
  return <Button data-slot="alert-dialog-action" {...props} />;
}

function AlertDialogCancel({
  variant = "outline",
  size = "default",
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogClose>, "className" | "render"> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return <AlertDialogClose render={<Button variant={variant} size={size} />} {...props} />;
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
};
