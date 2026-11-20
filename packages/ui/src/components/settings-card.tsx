import { cn } from "@quack/ui/lib/utils";
import type { ComponentProps } from "react";

/** A card of settings, one per row: what it is on the left, its control on the right, stacked on a narrow screen. */
export function SettingsCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("divide-y overflow-hidden rounded-xl border bg-card shadow-xs", className)}
      {...props}
    />
  );
}

export const settingsRow =
  "grid gap-x-8 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-center";

export function SettingsRowText({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SettingsRowControl({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function SettingsCardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-3 bg-muted/50 px-5 py-3", className)}
      {...props}
    />
  );
}
