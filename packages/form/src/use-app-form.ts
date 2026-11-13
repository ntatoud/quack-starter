import { createFormHook } from "@tanstack/react-form";

import { fieldContext, formContext } from "#/context.ts";
import { FormField } from "#/form-field.tsx";
import { Form } from "#/form.tsx";
import { FormLabel } from "#/form-label.tsx";
import { FormPasswordField } from "#/form-password-field.tsx";
import { FormSubmitButton } from "#/form-submit-button.tsx";
import { FormTextField } from "#/form-text-field.tsx";

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Root: FormField,
    Label: FormLabel,
    Text: FormTextField,
    Password: FormPasswordField,
  },
  formComponents: { Root: Form, SubmitButton: FormSubmitButton },
});
