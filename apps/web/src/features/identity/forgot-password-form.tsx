import { TooManyAttempts } from "@quack/contracts/identity/identity-errors";
import { PasswordResetRequestPayload } from "@quack/contracts/identity/identity-api";
import type { Email } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";
import { useState } from "react";

import { tooManyAttemptsMessage } from "#/features/identity/too-many-attempts-message.ts";
import { api } from "#/lib/api.ts";

const failureMessage = (cause: unknown) =>
  cause instanceof TooManyAttempts
    ? tooManyAttemptsMessage(cause.retryAfter)
    : "Could not send the link. Try again.";

/** Asks for a Password Reset link. What it says next is the same whether a User has the email or not. */
export function ForgotPasswordForm() {
  const requestPasswordReset = useMutation(api.identity.requestPasswordReset.mutationOptions());
  const [sentTo, setSentTo] = useState<Email | null>(null);

  const form = useAppForm({
    ...schemaFormOptions(PasswordResetRequestPayload, { email: "" }),
    onSubmit: async ({ value }) => {
      const payload = Schema.decodeSync(PasswordResetRequestPayload)(value);

      await requestPasswordReset.mutateAsync({ payload }).catch((cause: unknown) => {
        throw new SubmitFailed(failureMessage(cause), { cause });
      });

      setSentTo(payload.email);
    },
  });

  if (sentTo !== null) {
    return (
      <p role="status" className="text-sm">
        If an account exists for {sentTo}, we sent it a link to choose a new password. The link
        lasts 1 hour.
      </p>
    );
  }

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-4">
        <form.AppField name="email">
          {(field) => (
            <field.Root>
              <field.Label>Email</field.Label>
              <field.Text type="email" autoComplete="email" />
              <field.Description>The one you sign in with.</field.Description>
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Send the link</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
