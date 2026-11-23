import * as React from "react";
import { Input as InputPrimitive } from "@ui-sdk/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const inputVariants = cva(
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      // The heights of the Button sizes, so an input and a button of one size line up.
      // Text stays 16px on a touch screen: iOS zooms into smaller inputs on focus.
      size: {
        sm: "h-7 text-[0.8rem] pointer-coarse:text-base",
        md: "h-8 text-sm pointer-coarse:text-base",
        lg: "h-9 text-sm pointer-coarse:text-base",
      },
    },
    defaultVariants: { size: "md" },
  },
);

function Input({
  className,
  type,
  size = "md",
  ...props
}: Omit<React.ComponentProps<typeof InputPrimitive>, "size" | "className"> & {
  size?: NonNullable<VariantProps<typeof inputVariants>["size"]>;
  className?: string | undefined;
}) {
  return (
    <InputPrimitive type={type} className={cn(inputVariants({ size, className }))} {...props} />
  );
}

export { Input, inputVariants };
