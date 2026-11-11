import { EmailAlreadyTaken } from "@quack/contracts/identity/identity-errors";
import { Email, Password, type User } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";

import { api } from "#/lib/api.ts";

/** What the sign-up form holds, decoded with the contract's own rules so the form and the API agree. */
const SignUpDraft = Schema.Struct({ email: Email, password: Password });

const decodeSignUpDraft = Schema.decodeSync(SignUpDraft);
const emptySignUpDraft: typeof SignUpDraft.Encoded = { email: "", password: "" };

/**
 * Signs a visitor up. The API sets the session cookie, so the visitor is signed in when `onSignedUp` runs:
 * it receives the new User, and the form stays busy until it settles.
 */
export function SignUpForm({ onSignedUp }: { onSignedUp: (user: User) => void | Promise<void> }) {
  const signUp = useMutation(api.identity.signUp.mutationOptions());

  const form = useAppForm({
    ...schemaFormOptions(SignUpDraft, emptySignUpDraft),
    onSubmit: async ({ value }) => {
      const user = await signUp
        .mutateAsync({ payload: decodeSignUpDraft(value) })
        .catch((cause: unknown) => {
          throw new SubmitFailed(
            cause instanceof EmailAlreadyTaken
              ? "A user already signed up with this email."
              : "Could not sign up. Try again.",
            { cause },
          );
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
