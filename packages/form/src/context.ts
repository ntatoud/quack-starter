import { createFormHookContexts } from "@tanstack/react-form";

/** What ties a field or form component to the form it is rendered in. */
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
