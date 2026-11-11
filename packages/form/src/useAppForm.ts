import { createFormHook } from "@tanstack/react-form";

import { fieldContext, formContext } from "#/context.ts";
import { FormField } from "#/FormField.tsx";
import { Form } from "#/Form.tsx";
import { FormLabel } from "#/FormLabel.tsx";
import { FormSubmitButton } from "#/FormSubmitButton.tsx";
import { FormTextField } from "#/FormTextField.tsx";

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
