import { cn } from "cn";

import { brand } from "#/brand.ts";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground"
      >
        {brand.initial}
      </span>
      <span className="truncate font-semibold">{brand.name}</span>
    </span>
  );
}
