import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * A card of settings, one per row: each `Field` it holds is a row, what it is on the left (`SettingsRowText`), its
 * control on the right (`SettingsRowControl`), stacked while the card is narrow (`@xl` and its variants, not `sm`: the
 * width of the card follows the sidebar and the menu next to it, not the window alone).
 */
export function SettingsCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "@container divide-y overflow-hidden rounded-xl border bg-card",
        "*:data-[slot=field]:grid *:data-[slot=field]:gap-x-8 *:data-[slot=field]:gap-y-3 *:data-[slot=field]:px-5 *:data-[slot=field]:py-4",
        "@xl:*:data-[slot=field]:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] @xl:*:data-[slot=field]:items-center",
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
