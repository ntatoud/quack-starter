import { toast } from "@quack/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";

import { ConfirmEmail } from "#/features/email-change/confirm-email.tsx";
import { ExpiredEmailLink } from "#/features/email-change/expired-email-link.tsx";
import { currentUserQueryOptions } from "#/features/identity/current-user.ts";
import { GuestCard } from "#/features/identity/guest-card.tsx";
import { api } from "#/lib/api.ts";

export function ConfirmEmailPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useSearch({ from: "/_link/confirm-email" });

  return (
    <GuestCard
      title="Confirm your new email"
      description="It becomes the one you sign in with. You stay signed in on your devices."
    >
      {token === undefined ? (
        <ExpiredEmailLink />
      ) : (
        <ConfirmEmail
          token={token}
          onConfirmed={async () => {
            // Refetched, not only invalidated: no component observes the Current User, so nothing else would.
            await Promise.all([
              queryClient.refetchQueries({ queryKey: currentUserQueryOptions.queryKey }),
              queryClient.invalidateQueries({ queryKey: api.identity.me.key() }),
            ]);
            await router.invalidate();
            // A device with no Session is led to sign in first, and the toast waits for no page.
            await navigate({ to: "/app/settings/email" });
            toast.success("Email changed", { description: "Sign in with it from now on." });
          }}
        />
      )}
    </GuestCard>
  );
}
