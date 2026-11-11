import { createFormHook } from "@tanstack/react-form";

import { fieldContext, formContext } from "#/context.ts";
import { FormField } from "#/form-field.tsx";
import { Form } from "#/form.tsx";
import { FormLabel } from "#/form-label.tsx";
import { FormSubmitButton } from "#/form-submit-button.tsx";
import { FormTextField } from "#/form-text-field.tsx";

/**
 * The app's form hook: `useAppForm` is `useForm` with the app's components on `form.AppField`
 * (`field.Root`, `field.Label`, `field.Text`) and `form.AppForm` (`form.Root`, `form.SubmitButton`).
 * Register a new field or form component here, under its name without the `Form` that `field.` or `form.` already says.
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { Root: FormField, Label: FormLabel, Text: FormTextField },
  formComponents: { Root: Form, SubmitButton: FormSubmitButton },
});
