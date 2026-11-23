import type { Credentials } from "@quack/contracts/identity/identity-api";
import type { User } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { Schema } from "effect";
import type { ReactNode } from "react";

const emptyCredentials: typeof Credentials.Encoded = { email: "", password: "" };

/** The email and password form that sign-in and sign-up share, which differ in the call, the messages, and the autofill hint. */
export function CredentialsForm({
  schema,
  submit,
  failureMessage,
  passwordAutoComplete,
  submitLabel,
  passwordAction,
  onDone,
}: {
  schema: typeof Credentials;
  submit: (payload: typeof Credentials.Type) => Promise<User>;
  failureMessage: (cause: unknown) => string;
  passwordAutoComplete: "current-password" | "new-password";
  submitLabel: string;
  passwordAction?: ReactNode;
  onDone: (user: User) => void | Promise<void>;
}) {
  const form = useAppForm({
    ...schemaFormOptions(schema, emptyCredentials),
    onSubmit: async ({ value }) => {
      const user = await submit(Schema.decodeSync(schema)(value)).catch((cause: unknown) => {
        throw new SubmitFailed(failureMessage(cause), { cause });
      });

      await onDone(user);
    },
  });

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-4">
        <form.AppField name="email">
          {(field) => (
            <field.Root>
              <field.Label>Email</field.Label>
              <field.Text type="email" autoComplete="email" />
            </field.Root>
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.Root>
              <div className="flex items-baseline justify-between gap-2">
                <field.Label>Password</field.Label>
                {passwordAction}
              </div>
              <field.Password autoComplete={passwordAutoComplete} />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>{submitLabel}</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
