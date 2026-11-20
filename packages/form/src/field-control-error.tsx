import { FieldError } from "@quack/ui/components/field";

import { textSize } from "#/size.ts";
import type { useFieldControl } from "#/use-field-control.ts";

type Control = Pick<ReturnType<typeof useFieldControl>, "errorId" | "invalid" | "size" | "errors">;

/** Not an alert: the control describes itself with the error, and an alert would interrupt typing. */
export function FieldControlError({ control }: { control: Control }) {
  const { errorId, invalid, size, errors } = control;
  if (!invalid) return null;
  return <FieldError id={errorId} role={undefined} className={textSize[size]} errors={errors} />;
}
