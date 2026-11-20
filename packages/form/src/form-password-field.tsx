import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@quack/ui/components/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { FieldControlError } from "#/field-control-error.tsx";
import { useFieldControl } from "#/use-field-control.ts";

/** The toggle keeps its name, "Show password", and says whether the password shows by being pressed. */
export function FormPasswordField(
  props: Omit<
    ComponentProps<typeof InputGroupInput>,
    | "id"
    | "name"
    | "type"
    | "value"
    | "defaultValue"
    | "onChange"
    | "onBlur"
    | "aria-invalid"
    | "aria-describedby"
  >,
) {
  const control = useFieldControl();
  const { field, id, size, invalid, describedBy } = control;
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOffIcon : EyeIcon;

  return (
    <>
      <InputGroup size={size}>
        <InputGroupInput
          {...props}
          id={id}
          name={field.name}
          type={visible ? "text" : "password"}
          value={field.state.value}
          onChange={(event) => field.handleChange(event.target.value)}
          onBlur={field.handleBlur}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Show password"
            aria-controls={id}
            aria-pressed={visible}
            disabled={props.disabled}
            onClick={() => setVisible((shown) => !shown)}
          >
            <Icon aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldControlError control={control} />
    </>
  );
}
