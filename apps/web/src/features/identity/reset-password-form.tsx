import { ExpiredLink } from "@quack/contracts/identity/identity-errors";
import { Password } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";
import { useState } from "react";

import { ExpiredResetLink } from "#/features/identity/expired-reset-link.tsx";
import { api } from "#/lib/api.ts";

const NewPassword = Schema.Struct({ password: Password });

/** Chooses the new password of a Password Reset. The token is checked on submit, not before. */
export function ResetPasswordForm({
  token,
  onReset,
}: {
  token: string;
  onReset: () => void | Promise<void>;
}) {
  const confirmPasswordReset = useMutation(api.identity.confirmPasswordReset.mutationOptions());
  const [expired, setExpired] = useState(false);

  const form = useAppForm({
    ...schemaFormOptions(NewPassword, { password: "" }),
    onSubmit: async ({ value }) => {
      const { password } = Schema.decodeSync(NewPassword)(value);

      try {
        await confirmPasswordReset.mutateAsync({ payload: { token, password } });
      } catch (cause) {
        if (cause instanceof ExpiredLink) return setExpired(true);

        throw new SubmitFailed("Could not set the password. Try again.", { cause });
      }

      await onReset();
    },
  });

  if (expired) return <ExpiredResetLink />;

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-4">
        <form.AppField name="password">
          {(field) => (
            <field.Root>
              <field.Label>New password</field.Label>
              <field.Password autoComplete="new-password" />
            </field.Root>
          )}
        </form.AppField>
        <form.SubmitButton>Set the new password</form.SubmitButton>
      </form.Root>
    </form.AppForm>
  );
}
