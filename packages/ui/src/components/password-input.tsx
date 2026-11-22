import * as React from "react";
import {
  PasswordInput as PasswordInputPrimitive,
  PasswordInputControl as PasswordInputControlPrimitive,
  PasswordInputToggle as PasswordInputTogglePrimitive,
} from "@ui-sdk/react/password-input";
import { cn } from "cn";

import {
  InputGroup,
  InputGroupButton,
  inputGroupInputClassName,
} from "@quack/ui/components/input-group";

function PasswordInput({
  size = "md",
  ...props
}: Omit<React.ComponentProps<typeof PasswordInputPrimitive>, "render" | "className"> & {
  size?: React.ComponentProps<typeof InputGroup>["size"];
}) {
  return <PasswordInputPrimitive render={<InputGroup size={size} />} {...props} />;
}

function PasswordInputControl({
  className,
  ...props
}: Omit<React.ComponentProps<typeof PasswordInputControlPrimitive>, "className"> & {
  className?: string | undefined;
}) {
  return (
    <PasswordInputControlPrimitive className={cn(inputGroupInputClassName, className)} {...props} />
  );
}

function PasswordInputToggle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof PasswordInputTogglePrimitive>, "render" | "className"> & {
  className?: string | undefined;
}) {
  return (
    <PasswordInputTogglePrimitive
      render={<InputGroupButton size="icon-xs" className={cn("mr-1", className)} />}
      {...props}
    />
  );
}

export { PasswordInput, PasswordInputControl, PasswordInputToggle };
