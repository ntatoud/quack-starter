import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  isValid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftElement, rightElement, isValid, ...props }, ref) => {
    return (
      <div
        className={cn(
          "text-md flex w-full items-center rounded-md border border-input px-3 py-2",
          "placeholder:text-muted-foreground",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {leftElement}
        <input
          type={type}
          className="h-6 w-full focus:outline-none focus:ring-0"
          ref={ref}
          {...props}
        />
        {rightElement}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
