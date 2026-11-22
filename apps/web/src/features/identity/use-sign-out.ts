import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { api } from "#/lib/api.ts";

export const useSignOut = () => {
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();
  return useMutation(
    api.identity.signOut.mutationOptions({
      onSuccess: async () => {
        await setCurrentUser(null);
        await navigate({ to: "/sign-in" });
      },
    }),
  );
};

export const signOutLabel = ({ isPending }: { isPending: boolean }) =>
  isPending ? "Signing out…" : "Sign out";

export const signOutFailed = "Could not sign out. Try again.";
