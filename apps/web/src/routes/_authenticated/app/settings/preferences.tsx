import { createFileRoute } from "@tanstack/react-router";

import { pageTitle } from "#/features/layout/page-title.ts";
import { PreferencesSettingsPage } from "#/features/preferences/preferences-settings-page.tsx";

export const Route = createFileRoute("/_authenticated/app/settings/preferences")({
  head: () => ({ meta: [{ title: pageTitle("Preferences", "Settings") }] }),
  component: PreferencesSettingsPage,
});
