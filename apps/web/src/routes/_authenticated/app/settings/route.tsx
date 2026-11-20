import { createFileRoute } from "@tanstack/react-router";

import { SettingsLayout } from "#/features/settings/settings-layout.tsx";

export const Route = createFileRoute("/_authenticated/app/settings")({ component: SettingsLayout });
