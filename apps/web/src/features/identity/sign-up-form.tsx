import { EmailAlreadyTaken, TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { SignUpPayload } from "@quack/contracts/identity/identity-api";
import type { User } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";

import { tooManyAttemptsMessage } from "#/features/identity/too-many-attempts-message.ts";
import { api } from "#/lib/api.ts";

const decodeSignUpPayload = Schema.decodeSync(SignUpPayload);
const emptySignUpPayload: typeof SignUpPayload.Encoded = { email: "", password: "" };

const submitFailure = (cause: unknown) => {
  if (cause instanceof EmailAlreadyTaken) return "A user already signed up with this email.";
  if (cause instanceof TooManyAttempts) return tooManyAttemptsMessage(cause.retryAfter);
  return "Could not sign up. Try again.";
};

/**
 * Signs a visitor up. The API sets the session cookie, so the visitor is signed in when `onSignedUp` runs:
 * it receives the new User, and the form stays busy until it settles.
 */
export function SignUpForm({ onSignedUp }: { onSignedUp: (user: User) => void | Promise<void> }) {
  const signUp = useMutation(api.identity.signUp.mutationOptions());

  const form = useAppForm({
    ...schemaFormOptions(SignUpPayload, emptySignUpPayload),
    onSubmit: async ({ value }) => {
      const user = await signUp
        .mutateAsync({ payload: decodeSignUpPayload(value) })
        .catch((cause: unknown) => {
          throw new SubmitFailed(submitFailure(cause), { cause });
        });
      await onSignedUp(user);
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
              <field.Label>Password</field.Label>
              <field.Text type="password" autoComplete="new-password" />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Sign up</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
