import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { ConfirmEmailPage } from "#/features/email-change/confirm-email-page.tsx";
import { ConfirmEmailSearch } from "#/features/email-change/confirm-email-search.ts";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_link/confirm-email")({
  validateSearch: Schema.toStandardSchemaV1(ConfirmEmailSearch),
  head: () => ({ meta: [{ title: pageTitle("Confirm your new email") }] }),
  component: ConfirmEmailPage,
});
