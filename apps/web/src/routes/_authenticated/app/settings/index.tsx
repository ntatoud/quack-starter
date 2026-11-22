import { createFileRoute } from "@tanstack/react-router";

import { pageTitle } from "#/features/layout/page-title.ts";
import { SettingsHome } from "#/features/settings/settings-home.tsx";

export const Route = createFileRoute("/_authenticated/app/settings/")({
  head: () => ({ meta: [{ title: pageTitle("Settings") }] }),
  component: SettingsHome,
});
