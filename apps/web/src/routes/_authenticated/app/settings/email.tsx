import { createFileRoute } from "@tanstack/react-router";

import { EmailSettingsPage } from "#/features/email-change/email-settings-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_authenticated/app/settings/email")({
  head: () => ({ meta: [{ title: pageTitle("Email", "Settings") }] }),
  component: EmailSettingsPage,
});
