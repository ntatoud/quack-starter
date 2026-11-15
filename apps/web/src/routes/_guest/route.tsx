import { createFileRoute } from "@tanstack/react-router";

import { GuestLayout } from "#/features/layout/guest-layout.tsx";

export const Route = createFileRoute("/_guest")({ component: GuestLayout });
