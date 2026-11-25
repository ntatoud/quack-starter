import { createFileRoute } from "@tanstack/react-router";

import { GuestLayout } from "#/features/layout/guest-layout.tsx";

// The pages a link sent by email opens, signed in or not: unlike `_guest`, they redirect no one.
export const Route = createFileRoute("/_link")({
  component: GuestLayout,
});
