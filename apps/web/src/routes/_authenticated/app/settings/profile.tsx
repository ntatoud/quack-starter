import { createFileRoute } from "@tanstack/react-router";

import { pageTitle } from "#/features/layout/page-title.ts";
import { ProfileSettingsPage } from "#/features/profile/profile-settings-page.tsx";

export const Route = createFileRoute("/_authenticated/app/settings/profile")({
  head: () => ({ meta: [{ title: pageTitle("Profile", "Settings") }] }),
  component: ProfileSettingsPage,
});
