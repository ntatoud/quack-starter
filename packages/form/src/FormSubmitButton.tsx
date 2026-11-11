import { Button } from "@quack/ui/components/button";
import { cn } from "@quack/ui/lib/utils";
import { useStore } from "@tanstack/react-form";
import type { ComponentProps } from "react";

import { useFormContext } from "#/context.ts";
import type { Size } from "#/Size.ts";

const buttonSize = { sm: "sm", md: "default", lg: "lg" } as const satisfies Record<Size, string>;

/**
 * The submit button of its `form.AppForm`, unavailable while the form is submitting.
 * It keeps the focus then, and it stays enabled while the form is invalid: a disabled button is skipped by the
 * keyboard and explains nothing, a submit shows the errors.
 */
export function FormSubmitButton({
  size = "md",
  className,
  ...props
}: { size?: Size } & Omit<
  ComponentProps<typeof Button>,
  "type" | "size" | "disabled" | "focusableWhenDisabled"
>) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  return (
    <Button
      {...props}
      // The button's own disabled style needs the `disabled` attribute, which would drop the focus.
      className={cn("aria-disabled:pointer-events-none aria-disabled:opacity-50", className)}
      type="submit"
      size={buttonSize[size]}
      disabled={isSubmitting}
      focusableWhenDisabled
    />
  );
}
