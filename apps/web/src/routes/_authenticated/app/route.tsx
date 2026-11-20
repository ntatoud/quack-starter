import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "#/features/layout/app-layout.tsx";

export const Route = createFileRoute("/_authenticated/app")({ component: AppLayout });
