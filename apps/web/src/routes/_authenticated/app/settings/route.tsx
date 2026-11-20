import { createFileRoute } from "@tanstack/react-router";

import { SettingsLayout } from "#/features/layout/settings-layout.tsx";

export const Route = createFileRoute("/_authenticated/app/settings")({ component: SettingsLayout });
