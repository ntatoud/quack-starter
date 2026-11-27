import { createFormHook } from "@tanstack/react-form";

import { fieldContext, formContext } from "#/context.ts";
import { FormComboboxField } from "#/form-combobox-field.tsx";
import { FormDescription } from "#/form-description.tsx";
import { FormField } from "#/form-field.tsx";
import { Form } from "#/form.tsx";
import { FormLabel } from "#/form-label.tsx";
import { FormPasswordField } from "#/form-password-field.tsx";
import { FormSelectField } from "#/form-select-field.tsx";
import { FormSubmitButton } from "#/form-submit-button.tsx";
import { FormSwitchField } from "#/form-switch-field.tsx";
import { FormTextField } from "#/form-text-field.tsx";
import { FormToggleGroupField } from "#/form-toggle-group-field.tsx";

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Root: FormField,
    Label: FormLabel,
    Description: FormDescription,
    Text: FormTextField,
    Password: FormPasswordField,
    Select: FormSelectField,
    Combobox: FormComboboxField,
    Switch: FormSwitchField,
    ToggleGroup: FormToggleGroupField,
  },
  formComponents: { Root: Form, SubmitButton: FormSubmitButton },
});
