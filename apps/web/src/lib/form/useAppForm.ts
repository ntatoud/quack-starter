import { createFormHook } from "@tanstack/react-form";

import { fieldContext, formContext } from "#/lib/form/context.ts";
import { Field } from "#/lib/form/Field.tsx";
import { Form } from "#/lib/form/Form.tsx";
import { Label } from "#/lib/form/Label.tsx";
import { SubmitButton } from "#/lib/form/SubmitButton.tsx";
import { TextField } from "#/lib/form/TextField.tsx";

/**
 * The app's form hook: `useAppForm` is `useForm` with the app's components on `form.AppField`
 * (`field.Field`, `field.Label`, `field.TextField`) and `form.AppForm` (`form.Form`, `form.SubmitButton`).
 * Register a new field or form component here.
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { Field, Label, TextField },
  formComponents: { Form, SubmitButton },
});
