import { createFileRoute } from "@tanstack/react-router";

import { SignUpPage } from "#/features/identity/sign-up-page.tsx";
import { pageTitle } from "#/features/layout/page-title.ts";

export const Route = createFileRoute("/_guest/sign-up")({
  head: () => ({ meta: [{ title: pageTitle("Sign up") }] }),
  component: SignUpPage,
});
