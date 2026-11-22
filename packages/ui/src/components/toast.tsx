"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
  toast,
} from "@ui-sdk/react/toast";
import { XIcon } from "lucide-react";

/**
 * Where the toasts of `toast()` show, stacked at the bottom of the page: render it once, near the root.
 * The stack follows the variables ui-sdk sets on the region and each toast (`--toast-index`, `--toast-height`...).
 */
function Toaster() {
  return (
    <ToastRegion
      side="bottom"
      align="end"
      className="h-(--toast-front-height) w-[min(356px,calc(100vw-2rem))] data-expanded:h-[calc(var(--toast-stack-height)+(var(--toast-count)-1)*12px)]"
    >
      {() => (
        <Toast className="absolute inset-x-0 bottom-0 z-[calc(100-var(--toast-index))] flex h-(--toast-height) [--y:calc(var(--toast-index)*-12px)] translate-x-(--toast-swipe-x,0px) translate-y-[calc(var(--y)+var(--toast-swipe-y,0px))] scale-[calc(1-var(--toast-index)*0.05)] items-start gap-3 overflow-hidden rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg transition-[translate,scale,opacity,height] duration-400 select-none not-data-front:not-data-expanded:h-(--toast-front-height) data-expanded:scale-100 data-expanded:[--y:calc(-1*(var(--toast-offset)+var(--toast-index)*12px))] data-ending-style:opacity-0 data-starting-style:transition-none data-starting-style:not-data-front:opacity-0 data-starting-style:data-front:[--y:100%] data-swiping:transition-none motion-reduce:transition-opacity">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <ToastTitle className="font-medium" />
            <ToastDescription className="text-muted-foreground" />
          </div>
          <ToastClose
            aria-label="Close"
            className="-m-1 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </ToastClose>
        </Toast>
      )}
    </ToastRegion>
  );
}

export { Toaster, toast };
