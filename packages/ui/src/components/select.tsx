"use client";

import * as React from "react";
import {
  Select,
  SelectContent as SelectContentPrimitive,
  SelectGroup,
  SelectGroupLabel as SelectGroupLabelPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectItemIndicator,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from "@ui-sdk/react/select";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

type WithClassName<Props> = Omit<Props, "className"> & { className?: string | undefined };

function SelectValue({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectValuePrimitive>>) {
  return (
    <SelectValuePrimitive
      className={cn("line-clamp-1 flex flex-1 items-center gap-1.5 text-left", className)}
      {...props}
    />
  );
}

// The heights of the Input sizes, so a select lines up with the inputs of a form.
const selectTriggerVariants = cva("", {
  variants: {
    size: {
      sm: "h-7 rounded-[min(var(--radius-md),10px)]",
      md: "h-8",
      lg: "h-9",
    },
  },
  defaultVariants: { size: "md" },
});

function SelectTrigger({
  className,
  size = "md",
  children,
  ...props
}: WithClassName<Omit<React.ComponentProps<typeof SelectTriggerPrimitive>, "children">> & {
  children?: React.ReactNode;
  size?: NonNullable<VariantProps<typeof selectTriggerVariants>["size"]>;
}) {
  return (
    <SelectTriggerPrimitive
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        selectTriggerVariants({ size }),
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none size-4 text-muted-foreground"
      />
    </SelectTriggerPrimitive>
  );
}

function SelectContent({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectContentPrimitive>>) {
  return (
    <SelectContentPrimitive
      className={cn(
        "z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none transition-[opacity,scale] duration-100 w-(--anchor-width) data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SelectGroupLabel({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectGroupLabelPrimitive>>) {
  return (
    <SelectGroupLabelPrimitive
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function SelectItem<T = string>({
  className,
  children,
  ...props
}: WithClassName<Omit<React.ComponentProps<typeof SelectItemPrimitive<T>>, "children">> & {
  children?: React.ReactNode;
}) {
  return (
    <SelectItemPrimitive
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon />
      </SelectItemIndicator>
    </SelectItemPrimitive>
  );
}

function SelectSeparator({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectSeparatorPrimitive>>) {
  return (
    <SelectSeparatorPrimitive
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
