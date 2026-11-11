import { InvalidCredentials, TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { SignInPayload } from "@quack/contracts/identity/identity-api";
import type { User } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";

import { tooManyAttemptsMessage } from "#/features/identity/retry-delay.ts";
import { api } from "#/lib/api.ts";

const decodeSignInPayload = Schema.decodeSync(SignInPayload);
const emptySignInPayload: typeof SignInPayload.Encoded = { email: "", password: "" };

const submitFailure = (cause: unknown) => {
  if (cause instanceof InvalidCredentials) return "Wrong email or password.";
  if (cause instanceof TooManyAttempts) return tooManyAttemptsMessage(cause.retryAfter);
  return "Could not sign in. Try again.";
};

/**
 * Signs a User in. The API sets the session cookie, so the User is signed in when `onSignedIn` runs:
 * it receives the User, and the form stays busy until it settles.
 */
export function SignInForm({ onSignedIn }: { onSignedIn: (user: User) => void | Promise<void> }) {
  const signIn = useMutation(api.identity.signIn.mutationOptions());

  const form = useAppForm({
    ...schemaFormOptions(SignInPayload, emptySignInPayload),
    onSubmit: async ({ value }) => {
      const user = await signIn
        .mutateAsync({ payload: decodeSignInPayload(value) })
        .catch((cause: unknown) => {
          throw new SubmitFailed(submitFailure(cause), { cause });
        });
      await onSignedIn(user);
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
              <field.Text type="password" autoComplete="current-password" />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Sign in</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
