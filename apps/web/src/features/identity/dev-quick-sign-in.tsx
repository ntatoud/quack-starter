import { devAccounts, devPassword } from "@quack/contracts/identity/dev-accounts";
import { SignInPayload } from "@quack/contracts/identity/identity-api";
import type { Role, User } from "@quack/contracts/identity/user";
import { Button } from "@quack/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { Schema } from "effect";

import { api } from "#/lib/api.ts";

const decodeSignInPayload = Schema.decodeSync(SignInPayload);
const roles: ReadonlyArray<Role> = ["user", "admin"];

export function DevQuickSignIn({
  onSignedIn,
}: {
  onSignedIn: (user: User) => void | Promise<void>;
}) {
  const signIn = useMutation(api.identity.signIn.mutationOptions());

  const signInAs = async (role: Role) => {
    const payload = decodeSignInPayload({ email: devAccounts[role], password: devPassword });
    await onSignedIn(await signIn.mutateAsync({ payload }));
  };

  return (
    <section aria-labelledby="dev-quick-sign-in" className="mt-6 border-t pt-4">
      <h2 id="dev-quick-sign-in" className="mb-2 text-sm text-muted-foreground">
        Dev quick sign-in
      </h2>
      <div className="flex gap-2">
        {roles.map((role) => (
          <Button
            key={role}
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={signIn.isPending}
            onClick={() => void signInAs(role).catch(() => undefined)}
          >
            As {role}
          </Button>
        ))}
      </div>
      {signIn.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Could not sign in. Is the server seeded (SEED_USERS=true)?
        </p>
      )}
    </section>
  );
}
