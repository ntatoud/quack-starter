import { EmailAlreadyTaken, TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { SignUpPayload } from "@quack/contracts/identity/identity-api";
import type { User } from "@quack/contracts/identity/user";
import { useMutation } from "@tanstack/react-query";

import { CredentialsForm } from "#/features/identity/credentials-form.tsx";
import { tooManyAttemptsMessage } from "#/features/identity/too-many-attempts-message.ts";
import { api } from "#/lib/api.ts";

const submitFailure = (cause: unknown) => {
  if (cause instanceof EmailAlreadyTaken) return "A user already signed up with this email.";

  if (cause instanceof TooManyAttempts) return tooManyAttemptsMessage(cause.retryAfter);

  return "Could not sign up. Try again.";
};

export function SignUpForm({ onSignedUp }: { onSignedUp: (user: User) => void | Promise<void> }) {
  const signUp = useMutation(api.identity.signUp.mutationOptions());

  return (
    <CredentialsForm
      schema={SignUpPayload}
      submit={(payload) => signUp.mutateAsync({ payload })}
      failureMessage={submitFailure}
      passwordAutoComplete="new-password"
      submitLabel="Sign up"
      onDone={onSignedUp}
    />
  );
}
