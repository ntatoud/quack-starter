import { InvalidCredentials, TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { SignInPayload } from "@quack/contracts/identity/identity-api";
import type { User } from "@quack/contracts/identity/user";
import { useMutation } from "@tanstack/react-query";

import { CredentialsForm } from "#/features/identity/credentials-form.tsx";
import { tooManyAttemptsMessage } from "#/features/identity/too-many-attempts-message.ts";
import { api } from "#/lib/api.ts";

const submitFailure = (cause: unknown) => {
  if (cause instanceof InvalidCredentials) return "Wrong email or password.";

  if (cause instanceof TooManyAttempts) return tooManyAttemptsMessage(cause.retryAfter);

  return "Could not sign in. Try again.";
};

export function SignInForm({ onSignedIn }: { onSignedIn: (user: User) => void | Promise<void> }) {
  const signIn = useMutation(api.identity.signIn.mutationOptions());

  return (
    <CredentialsForm
      schema={SignInPayload}
      submit={(payload) => signIn.mutateAsync({ payload })}
      failureMessage={submitFailure}
      passwordAutoComplete="current-password"
      submitLabel="Sign in"
      onDone={onSignedIn}
    />
  );
}
