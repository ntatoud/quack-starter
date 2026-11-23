import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { SignInSearch } from "#/features/identity/sign-in-search.ts";
import { SignInPage } from "#/features/identity/sign-in-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_guest/sign-in")({
  validateSearch: Schema.toStandardSchemaV1(SignInSearch),
  head: () => ({ meta: [{ title: pageTitle("Sign in") }] }),
  component: SignInPage,
});
