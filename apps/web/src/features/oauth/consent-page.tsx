import { Logo } from "@quack/brand/logo";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useRouteContext } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { authorizationParamsOf } from "#/features/oauth/authorization-check.ts";
import { ConsentPrompt } from "#/features/oauth/consent-prompt.tsx";
import { api } from "#/lib/api.ts";

export function ConsentPage() {
  const { currentUser } = useRouteContext({ from: "/oauth/authorize" });
  const { searchStr } = useLocation();
  const setCurrentUser = useSetCurrentUser();

  // The route sends a visitor to sign in, and back here once they have.
  const signOut = useMutation(
    api.identity.signOut.mutationOptions({ onSuccess: () => setCurrentUser(null) }),
  );

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <Logo className="text-lg" />
      <div className="w-full max-w-md rounded-xl border bg-background p-6 sm:p-8">
        <ConsentPrompt
          params={authorizationParamsOf(searchStr)}
          currentUser={currentUser}
          onRedirect={(url) => window.location.assign(url)}
          onSwitchAccount={() => signOut.mutate(undefined)}
        />
      </div>
    </main>
  );
}
