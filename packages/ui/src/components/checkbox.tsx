import * as React from "react";
import { Checkbox as CheckboxPrimitive, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { cn } from "cn";
import { CheckIcon, MinusIcon } from "lucide-react";

function Checkbox({
  className,
  ...props
}: Omit<React.ComponentProps<typeof CheckboxPrimitive>, "className" | "children"> & {
  className?: string | undefined;
}) {
  return (
    <CheckboxPrimitive
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:not-data-indeterminate:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary group-has-[:focus-visible]/field-label:data-indeterminate:border-primary dark:data-checked:bg-primary dark:data-indeterminate:bg-primary",
        className,
      )}
      {...props}
    >
      <CheckboxIndicator className="grid place-content-center text-current transition-none [&>svg]:size-3.5">
        {(state) =>
          state.indeterminate ? <MinusIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />
        }
      </CheckboxIndicator>
    </CheckboxPrimitive>
  );
}

export { Checkbox };
