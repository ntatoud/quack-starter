import {
  EmailAlreadyTaken,
  TooManyAttempts,
  WrongPassword,
} from "@quack/contracts/identity/identity-errors";
import { EmailChangeRequestPayload } from "@quack/contracts/identity/identity-api";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsRowControl,
  SettingsRowText,
} from "@quack/ui/components/settings-card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";

import { tooManyAttemptsMessage } from "#/features/identity/too-many-attempts-message.ts";
import { api } from "#/lib/api.ts";

const decodePayload = Schema.decodeSync(EmailChangeRequestPayload);

const failureMessage = (cause: unknown) => {
  if (cause instanceof WrongPassword) return "This is not your current password.";

  if (cause instanceof EmailAlreadyTaken) return "This email cannot be yours: an account has it.";

  if (cause instanceof TooManyAttempts) return tooManyAttemptsMessage(cause.retryAfter);

  return "Could not send the link. Try again.";
};

/** Asks for an Email Change: the new email takes effect once the link mailed to it is opened. */
export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const queryClient = useQueryClient();
  const requestEmailChange = useMutation(api.identity.requestEmailChange.mutationOptions());

  const form = useAppForm({
    ...schemaFormOptions(EmailChangeRequestPayload, { newEmail: "", password: "" }),
    onSubmit: async ({ value, formApi }) => {
      await requestEmailChange
        .mutateAsync({ payload: decodePayload(value) })
        .catch((cause: unknown) => {
          throw new SubmitFailed(failureMessage(cause), { cause });
        });

      formApi.reset();
      await queryClient.invalidateQueries({ queryKey: api.identity.me.key() });
    },
  });

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-3">
        <SettingsCard>
          <div data-slot="field">
            <SettingsRowText>
              <p className="text-sm font-medium">Current email</p>
              <p className="text-sm text-muted-foreground">The one you sign in with.</p>
            </SettingsRowText>
            <SettingsRowControl>
              <p className="truncate text-sm">{currentEmail}</p>
            </SettingsRowControl>
          </div>
          <form.AppField name="newEmail">
            {(field) => (
              <field.Root>
                <SettingsRowText>
                  <field.Label>New email</field.Label>
                  <field.Description>
                    We send it a link: your email changes once you open it.
                  </field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Text type="email" autoComplete="email" />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <form.AppField name="password">
            {(field) => (
              <field.Root>
                <SettingsRowText>
                  <field.Label>Current password</field.Label>
                  <field.Description>To make sure it is you.</field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Password autoComplete="current-password" />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <SettingsCardFooter>
            <form.SubmitButton>Send the link</form.SubmitButton>
          </SettingsCardFooter>
        </SettingsCard>
      </form.Root>
    </form.AppForm>
  );
}
