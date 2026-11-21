import { cn } from "@quack/ui/lib/utils";
import type { ComponentProps } from "react";

/** What a page shows under its `PageHeader`, as far from the edges as the header is. */
export function PageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-4 p-4 md:p-6", className)} {...props} />
  );
}
