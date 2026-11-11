import { createFormHook } from "@tanstack/react-form";

import { fieldContext, formContext } from "#/lib/form/context.ts";
import { FormField } from "#/lib/form/FormField.tsx";
import { Form } from "#/lib/form/Form.tsx";
import { FormLabel } from "#/lib/form/FormLabel.tsx";
import { FormSubmitButton } from "#/lib/form/FormSubmitButton.tsx";
import { FormTextField } from "#/lib/form/FormTextField.tsx";

/**
 * The app's form hook: `useAppForm` is `useForm` with the app's components on `form.AppField`
 * (`field.FormField`, `field.FormLabel`, `field.FormTextField`) and `form.AppForm` (`form.Form`, `form.FormSubmitButton`).
 * Register a new field or form component here.
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { FormField, FormLabel, FormTextField },
  formComponents: { Form, FormSubmitButton },
});
