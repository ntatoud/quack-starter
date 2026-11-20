import { FieldDescription } from "@quack/ui/components/field";
import { type ComponentProps, useLayoutEffect } from "react";

import { useRequiredFieldLayout } from "#/form-field.tsx";

export function FormDescription(props: Omit<ComponentProps<typeof FieldDescription>, "id">) {
  const { descriptionId, setHasDescription } = useRequiredFieldLayout("field.Description");

  useLayoutEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return <FieldDescription {...props} id={descriptionId} />;
}
