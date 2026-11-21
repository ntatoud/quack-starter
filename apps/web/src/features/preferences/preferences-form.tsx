import { schemaFormOptions } from "@quack/form/schema-form-options";
import { useAppForm } from "@quack/form/use-app-form";
import {
  SettingsCard,
  SettingsRowControl,
  SettingsRowText,
} from "@quack/ui/components/settings-card";
import { Schema } from "effect";

import { type PreferenceValues, Preferences } from "#/features/preferences/preferences.ts";
import { themeOptions } from "#/features/preferences/theme-options.ts";
import { useSetPreference } from "#/features/preferences/use-preference.ts";

const encodePreferences = Schema.encodeSync(Preferences.Values);

export function PreferencesForm({ preferences }: { preferences: PreferenceValues }) {
  const setPreference = useSetPreference();
  const form = useAppForm(schemaFormOptions(Preferences.Values, encodePreferences(preferences)));

  return (
    <form.AppForm>
      <form.Root>
        <SettingsCard>
          <form.AppField
            name="right-sidebar"
            listeners={{ onChange: ({ value }) => setPreference("right-sidebar", value) }}
          >
            {(field) => (
              <field.Root>
                <SettingsRowText>
                  <field.Label>Right sidebar</field.Label>
                  <field.Description>
                    The sidebar of the app sits on the right of the window, on this device.
                  </field.Description>
                </SettingsRowText>
                <SettingsRowControl className="items-start @xl:items-end">
                  <field.Switch />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
          <form.AppField
            name="theme"
            listeners={{ onChange: ({ value }) => setPreference("theme", value) }}
          >
            {(field) => (
              <field.Root>
                <SettingsRowText>
                  <field.Label>Theme</field.Label>
                  <field.Description>
                    Light or dark, on this device. System follows the operating system.
                  </field.Description>
                </SettingsRowText>
                <SettingsRowControl>
                  <field.Select options={themeOptions} />
                </SettingsRowControl>
              </field.Root>
            )}
          </form.AppField>
        </SettingsCard>
      </form.Root>
    </form.AppForm>
  );
}
