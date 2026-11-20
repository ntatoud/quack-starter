import { Profile, Team } from "@quack/contracts/identity/profile";
import { User } from "@quack/contracts/identity/user";
import { schemaFormOptions } from "@quack/form/schema-form-options";
import { SubmitFailed } from "@quack/form/submit-failed";
import { useAppForm } from "@quack/form/use-app-form";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";

import { useUpdateCurrentUser } from "#/features/identity/current-user.ts";
import {
  SettingsCard,
  SettingsCardFooter,
  settingsRow,
  SettingsRowControl,
  SettingsRowText,
} from "@quack/ui/components/settings-card";
import { countryOptions } from "#/features/profile/countries.ts";
import { ProfileDraft, profileDraftOf } from "#/features/profile/profile-draft.ts";
import { teamLabel } from "#/features/profile/team-label.ts";
import { UserAvatar } from "#/features/users/user-avatar.tsx";
import { api } from "#/lib/api.ts";

const decodeProfileDraft = Schema.decodeSync(ProfileDraft);
const encodeUser = Schema.encodeSync(User);
const teamOptions = Team.literals.map((team) => ({ value: team, label: teamLabel(team) }));

export function ProfileForm({ currentUser }: { currentUser: typeof User.Encoded }) {
  const updateCurrentUser = useUpdateCurrentUser();
  const updateProfile = useMutation(api.identity.updateProfile.mutationOptions());

  const form = useAppForm({
    ...schemaFormOptions(ProfileDraft, profileDraftOf(currentUser.profile)),
    onSubmit: async ({ value, formApi }) => {
      const user = await updateProfile
        .mutateAsync({ payload: new Profile(decodeProfileDraft(value)) })
        .catch((cause: unknown) => {
          throw new SubmitFailed("Could not save the profile. Try again.", { cause });
        });
      // The values as the API stored them; the defaults stay those of the Current User, which follows.
      formApi.reset(profileDraftOf(encodeUser(user).profile), { keepDefaultValues: true });
      await updateCurrentUser(user);
    },
  });

  return (
    <form.AppForm>
      <form.Root className="flex flex-col gap-3">
        <SettingsCard>
          <form.AppField name="firstName">
            {(field) => (
              <field.Root className={settingsRow}>
                <SettingsRowText>
                  <field.Label>First name</field.Label>
                  <field.Description>
                    Shown with your last name wherever you appear.
                  </field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Text autoComplete="given-name" />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <form.AppField name="lastName">
            {(field) => (
              <field.Root className={settingsRow}>
                <SettingsRowText>
                  <field.Label>Last name</field.Label>
                  <field.Description>Lists of Users are sorted by it.</field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Text autoComplete="family-name" />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <form.AppField name="avatarUrl">
            {(field) => (
              <field.Root className={settingsRow}>
                <SettingsRowText>
                  <field.Label>Avatar</field.Label>
                  <field.Description>
                    Not available yet: for now, an avatar is drawn for you.
                  </field.Description>
                </SettingsRowText>
                <SettingsRowControl className="flex-row items-start">
                  <UserAvatar
                    user={{
                      id: currentUser.id,
                      profile: { avatarUrl: field.state.value.trim() || null },
                    }}
                    className="rounded-lg after:rounded-lg"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <field.Text type="url" placeholder="https://" disabled />
                  </div>
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <form.AppField name="jobTitle">
            {(field) => (
              <field.Root className={settingsRow}>
                <SettingsRowText>
                  <field.Label>Job title</field.Label>
                  <field.Description>Optional. What you do, in a few words.</field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Text autoComplete="organization-title" />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <form.AppField name="team">
            {(field) => (
              <field.Root className={settingsRow}>
                <SettingsRowText>
                  <field.Label>Team</field.Label>
                  <field.Description>Optional. The team you belong to.</field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Select
                    options={teamOptions}
                    placeholder="Choose a team"
                    noneLabel="No team"
                  />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <form.AppField name="country">
            {(field) => (
              <field.Root className={settingsRow}>
                <SettingsRowText>
                  <field.Label>Country</field.Label>
                  <field.Description>Optional. Where you work from.</field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Combobox
                    options={countryOptions}
                    placeholder="Search a country"
                    empty="No country found."
                    clearable
                  />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <SettingsCardFooter>
            <form.Subscribe selector={(state) => state.isDirty}>
              {(edited) => (
                <p role="status" className="mr-auto text-sm text-muted-foreground">
                  {updateProfile.isSuccess && !edited && "Profile saved"}
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
