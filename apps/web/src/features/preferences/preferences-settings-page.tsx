import { PreferencesForm } from "#/features/preferences/preferences-form.tsx";
import { usePreferences } from "#/features/preferences/use-preference.ts";

export function PreferencesSettingsPage() {
  return <PreferencesForm preferences={usePreferences()} />;
}
