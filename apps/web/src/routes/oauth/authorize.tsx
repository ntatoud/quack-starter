import { createFileRoute, redirect } from "@tanstack/react-router";

import { signInLocation } from "#/features/identity/redirect-target.ts";
import { pageTitle } from "#/features/layout/page-title.ts";
import {
  authorizationParamsOf,
  rememberedConsentRedirect,
} from "#/features/oauth/authorization-check.ts";
import { ConsentPage } from "#/features/oauth/consent-page.tsx";

// No `validateSearch`: the page reads the query as the AI Client wrote it (`searchStr`), since the router's
// parser would read a `state` of digits as a number.
export const Route = createFileRoute("/oauth/authorize")({
  beforeLoad: ({ context, location }) => {
    if (context.currentUser === null) throw redirect(signInLocation(location.href));

    return { currentUser: context.currentUser };
  },
  // In the browser: the check needs the Session cookie, which the API client has not in the server render.
  ssr: false,
  loader: async ({ context, location }) => {
    const redirectTo = await rememberedConsentRedirect(
      context.queryClient,
      authorizationParamsOf(location.searchStr),
    );

    // The redirect URI is another origin: the router leaves the app for it.
    if (redirectTo !== undefined) throw redirect({ href: redirectTo });
  },
  head: () => ({ meta: [{ title: pageTitle("Connect an AI Client") }] }),
  component: ConsentPage,
});
