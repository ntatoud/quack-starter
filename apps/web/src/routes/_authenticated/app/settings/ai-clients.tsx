import { createFileRoute } from "@tanstack/react-router";

import { GrantsList } from "#/features/grants/grants-list.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_authenticated/app/settings/ai-clients")({
  head: () => ({ meta: [{ title: pageTitle("AI Clients", "Settings") }] }),
  component: GrantsList,
});
