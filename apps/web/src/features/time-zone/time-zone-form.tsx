import { TimeZonePayload } from "@quack/contracts/users/users-api";
import type { User } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsRowControl,
  SettingsRowText,
} from "@quack/ui/components/settings-card";
import { useMutation } from "@tanstack/react-query";
import { DateTime, Schema } from "effect";

import { useUpdateCurrentUser } from "#/features/identity/current-user.ts";
import { api } from "#/lib/api.ts";

const decodeTimeZone = Schema.decodeSync(TimeZonePayload);

// The browser's list leaves out aliases such as `UTC`, which a User may have: theirs is added when it is missing.
const timeZoneOptions = (current: string) =>
  [...new Set([...Intl.supportedValuesOf("timeZone"), current])]
    .toSorted((a, b) => a.localeCompare(b, "en"))
    .map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }));

export function TimeZoneForm({ currentUser }: { currentUser: typeof User.Encoded }) {
  const updateCurrentUser = useUpdateCurrentUser();
  const updateTimeZone = useMutation(api.users.updateTimeZone.mutationOptions());

  const form = useAppForm({
    ...schemaFormOptions(TimeZonePayload, { timeZone: currentUser.timeZone }),
    onSubmit: async ({ value, formApi }) => {
      const user = await updateTimeZone
        .mutateAsync({ payload: decodeTimeZone(value) })
        .catch((cause: unknown) => {
          throw new SubmitFailed("Could not save the time zone. Try again.", { cause });
        });

      // The value as the API stored it; the default stays that of the Current User, which follows.
      formApi.reset(
        { timeZone: DateTime.zoneToString(user.timeZone) },
        { keepDefaultValues: true },
      );
      await updateCurrentUser(user);
    },
  });

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-3">
        <SettingsCard>
          <form.AppField name="timeZone">
            {(field) => (
              <field.Root>
                <SettingsRowText>
                  <field.Label>Time zone</field.Label>
                  <field.Description>
                    Your days start at midnight in this time zone.
                  </field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Combobox
                    options={timeZoneOptions(currentUser.timeZone)}
                    placeholder="Search a time zone"
                    empty="No time zone found."
                  />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <SettingsCardFooter>
            <form.Subscribe selector={(state) => state.isDirty}>
              {(edited) => (
                <p role="status" className="mr-auto text-sm text-muted-foreground">
                  {updateTimeZone.isSuccess && !edited && "Time zone saved"}
                </p>
              )}
            </form.Subscribe>
            <form.SubmitButton>Save</form.SubmitButton>
          </SettingsCardFooter>
        </SettingsCard>
      </form.Root>
    </form.AppForm>
  );
}
