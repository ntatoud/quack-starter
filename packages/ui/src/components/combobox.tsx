"use client";

import * as React from "react";
import {
  Combobox,
  ComboboxClear as ComboboxClearPrimitive,
  ComboboxContent as ComboboxContentPrimitive,
  ComboboxEmpty as ComboboxEmptyPrimitive,
  ComboboxInput as ComboboxInputPrimitive,
  ComboboxItem as ComboboxItemPrimitive,
  ComboboxItemIndicator,
  ComboboxList as ComboboxListPrimitive,
  ComboboxTrigger,
} from "@ui-sdk/react/combobox";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  inputGroupInputClassName,
} from "@quack/ui/components/input-group";

export type WithClassName<Props> = Omit<Props, "className" | "children"> & {
  className?: string | undefined;
  children?: React.ReactNode;
};

function ComboboxInput({
  className,
  disabled = false,
  showTrigger = true,
  showClear = false,
  size = "md",
  ...props
}: Omit<React.ComponentProps<typeof ComboboxInputPrimitive>, "className" | "size"> & {
  className?: string | undefined;
  showTrigger?: boolean;
  showClear?: boolean;
  size?: NonNullable<React.ComponentProps<typeof InputGroup>["size"]>;
}) {
  return (
    <InputGroup size={size} className={cn("w-auto", className)}>
      <ComboboxInputPrimitive className={inputGroupInputClassName} disabled={disabled} {...props} />
      <InputGroupAddon align="inline-end">
        {showClear && (
          <ComboboxClearPrimitive
            render={<InputGroupButton variant="ghost" size="icon-xs" />}
            aria-label="Clear"
            disabled={disabled}
          >
            <XIcon aria-hidden="true" />
          </ComboboxClearPrimitive>
        )}
        {showTrigger && !showClear && (
          <ComboboxTrigger
            render={<InputGroupButton variant="ghost" size="icon-xs" />}
            aria-label="Show options"
            disabled={disabled}
          >
            <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
          </ComboboxTrigger>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}

function ComboboxContent({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof ComboboxContentPrimitive>>) {
  return (
    <ComboboxContentPrimitive
      className={cn(
        "z-50 max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-float ring-1 ring-foreground/10 transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxList({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof ComboboxListPrimitive>>) {
  return (
    <ComboboxListPrimitive
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxItem<T = string>({
  className,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof ComboboxItemPrimitive<T>>>) {
  return (
    <ComboboxItemPrimitive
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon aria-hidden="true" />
      </ComboboxItemIndicator>
    </ComboboxItemPrimitive>
  );
}

function ComboboxEmpty({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof ComboboxEmptyPrimitive>>) {
  return (
    <ComboboxEmptyPrimitive
      className={cn(
        "w-full justify-center py-2 text-center text-sm text-muted-foreground data-empty:flex",
        className,
      )}
      {...props}
    />
  );
}

export { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList };
