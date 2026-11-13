import { Button } from "@quack/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { api } from "#/lib/api.ts";

export function SignOutButton() {
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();
  const signOut = useMutation(
    api.identity.signOut.mutationOptions({
      onSuccess: async () => {
        await setCurrentUser(null);
        await navigate({ to: "/sign-in" });
      },
    }),
  );

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate(undefined)}
    >
      Sign out
    </Button>
  );
}
