import { Switch } from "@quack/ui/components/switch";

import { FieldControlError } from "#/field-control-error.tsx";
import { useFieldControl } from "#/use-field-control.ts";

/** A choice that is on or off, of a boolean field. */
export function FormSwitchField() {
  const control = useFieldControl<boolean>();
  const { field, id, size, invalid, describedBy } = control;

  return (
    <>
      <Switch
        id={id}
        name={field.name}
        size={size === "sm" ? "sm" : "default"}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked)}
        onBlur={field.handleBlur}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <FieldControlError control={control} />
    </>
  );
}
