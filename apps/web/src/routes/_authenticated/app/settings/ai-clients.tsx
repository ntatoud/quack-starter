import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { pageTitle } from "#/features/layout/page-title.ts";
import { GrantsPage } from "#/features/prototype-grants/grants-page.tsx";
import { GrantsSearch } from "#/features/prototype-grants/grants-search.ts";

export const Route = createFileRoute("/_authenticated/app/settings/ai-clients")({
  validateSearch: Schema.toStandardSchemaV1(GrantsSearch),
  head: () => ({ meta: [{ title: pageTitle("AI Clients", "Settings") }] }),
  component: GrantsPage,
});
