import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputToggle,
} from "@quack/ui/components/password-input";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { FieldControlError } from "#/field-control-error.tsx";
import { useFieldControl } from "#/use-field-control.ts";

/** The toggle keeps its name, "Show password", and says whether the password shows by being pressed. */
export function FormPasswordField({
  autoComplete,
  disabled,
  readOnly,
  required,
  ...props
}: Pick<
  ComponentProps<typeof PasswordInput>,
  "autoComplete" | "disabled" | "readOnly" | "required"
> &
  Omit<
    ComponentProps<typeof PasswordInputControl>,
    "id" | "onBlur" | "aria-invalid" | "aria-describedby"
  >) {
  const control = useFieldControl();
  const { field, id, size, invalid, describedBy } = control;

  return (
    <>
      <PasswordInput
        size={size}
        name={field.name}
        value={field.state.value}
        onValueChange={field.handleChange}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(readOnly === undefined ? {} : { readOnly })}
        {...(required === undefined ? {} : { required })}
      >
        <PasswordInputControl
          {...props}
          id={id}
          onBlur={field.handleBlur}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        <PasswordInputToggle aria-label="Show password">
          {(state) =>
            state.visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />
          }
        </PasswordInputToggle>
      </PasswordInput>
      <FieldControlError control={control} />
    </>
  );
}
