"use client";

import * as React from "react";
import {
  Menu,
  MenuCheckboxItem as MenuCheckboxItemPrimitive,
  MenuContent as MenuContentPrimitive,
  MenuContextTrigger as MenuContextTriggerPrimitive,
  MenuGroup,
  MenuGroupLabel as MenuGroupLabelPrimitive,
  MenuItem as MenuItemPrimitive,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem as MenuRadioItemPrimitive,
  MenuSeparator as MenuSeparatorPrimitive,
  MenuShortcut as MenuShortcutPrimitive,
  MenuSub,
  MenuSubContent as MenuSubContentPrimitive,
  MenuSubTrigger as MenuSubTriggerPrimitive,
  MenuTrigger,
  createMenuController,
} from "@ui-sdk/react/menu";
import { cn } from "cn";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

export type WithClassName<Props> = Omit<Props, "className" | "children"> & {
  className?: string | undefined;
  children?: React.ReactNode;
};

const popupClassName =
  "z-50 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-float ring-1 ring-foreground/10 outline-none transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0";

const itemClassName =
  "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function MenuContextTrigger({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuContextTriggerPrimitive>>) {
  return <MenuContextTriggerPrimitive className={cn("select-none", className)} {...props} />;
}

function MenuContent({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuContentPrimitive>>) {
  return <MenuContentPrimitive className={cn(popupClassName, className)} {...props} />;
}

function MenuGroupLabel({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuGroupLabelPrimitive>>) {
  return (
    <MenuGroupLabelPrimitive
      className={cn("px-1.5 py-1 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

function MenuItem({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuItemPrimitive>>) {
  return (
    <MenuItemPrimitive
      className={cn(
        itemClassName,
        "group/menu-item data-destructive:text-destructive data-destructive:data-highlighted:bg-destructive/10 data-destructive:data-highlighted:text-destructive dark:data-destructive:data-highlighted:bg-destructive/20 not-data-destructive:data-highlighted:**:text-accent-foreground data-destructive:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function MenuSubTrigger({
  className,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuSubTriggerPrimitive>>) {
  return (
    <MenuSubTriggerPrimitive
      className={cn(
        itemClassName,
        "data-open:bg-accent data-open:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon aria-hidden="true" className="ml-auto" />
    </MenuSubTriggerPrimitive>
  );
}

function MenuSubContent({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuSubContentPrimitive>>) {
  return <MenuSubContentPrimitive className={cn(popupClassName, className)} {...props} />;
}

function MenuCheckboxItem({
  className,
  children,
  indicator = "end",
  ...props
}: WithClassName<React.ComponentProps<typeof MenuCheckboxItemPrimitive>> & {
  /**
   * The check after the label; a box before it, shown unticked too, which tells a choice of several from a choice
   * of one; or none, for an item whose content shows its state (a toggled icon).
   */
  indicator?: "end" | "checkbox" | "none";
}) {
  return (
    <MenuCheckboxItemPrimitive
      className={cn(
        itemClassName,
        "group/checkbox-item pr-8 data-highlighted:**:text-accent-foreground",
        indicator === "checkbox" && "pr-1.5 pl-7",
        indicator === "none" && "pr-1.5",
        className,
      )}
      {...props}
    >
      {indicator === "end" && (
        <span className="pointer-events-none absolute right-2 flex items-center justify-center">
          <MenuItemIndicator>
            <CheckIcon aria-hidden="true" />
          </MenuItemIndicator>
        </span>
      )}
      {indicator === "checkbox" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center rounded-[4px] border border-input group-data-checked/checkbox-item:border-primary group-data-checked/checkbox-item:bg-primary group-data-checked/checkbox-item:text-primary-foreground"
        >
          <MenuItemIndicator className="flex">
            <CheckIcon aria-hidden="true" className="size-3" />
          </MenuItemIndicator>
        </span>
      )}
      {children}
    </MenuCheckboxItemPrimitive>
  );
}

function MenuRadioItem({
  className,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuRadioItemPrimitive>>) {
  return (
    <MenuRadioItemPrimitive
      className={cn(itemClassName, "pr-8 data-highlighted:**:text-accent-foreground", className)}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <MenuItemIndicator>
          <CheckIcon aria-hidden="true" />
        </MenuItemIndicator>
      </span>
      {children}
    </MenuRadioItemPrimitive>
  );
}

function MenuSeparator({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuSeparatorPrimitive>>) {
  return (
    <MenuSeparatorPrimitive className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  );
}

function MenuShortcut({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuShortcutPrimitive>>) {
  return (
    <MenuShortcutPrimitive
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/menu-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuContextTrigger,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  createMenuController,
};
