import { cn } from "@quack/ui/lib/utils";
import type { ComponentProps } from "react";

/**
 * A card of settings, one per row: each `Field` it holds is a row, what it is on the left (`SettingsRowText`), its
 * control on the right (`SettingsRowControl`), stacked on a narrow screen.
 */
export function SettingsCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "divide-y overflow-hidden rounded-xl border bg-card shadow-xs",
        "*:data-[slot=field]:grid *:data-[slot=field]:gap-x-8 *:data-[slot=field]:gap-y-3 *:data-[slot=field]:px-5 *:data-[slot=field]:py-4",
        "sm:*:data-[slot=field]:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:*:data-[slot=field]:items-center",
        className,
      )}
      {...props}
    />
  );
}

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
