import { toast } from "@quack/ui/components/toast";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { ExpiredResetLink } from "#/features/identity/expired-reset-link.tsx";
import { GuestCard } from "#/features/identity/guest-card.tsx";
import { ResetPasswordForm } from "#/features/identity/reset-password-form.tsx";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/_guest/reset-password" });

  return (
    <GuestCard
      title="Choose a new password"
      description="It replaces the old one, and signs you out on every device."
    >
      {token === undefined ? (
        <ExpiredResetLink />
      ) : (
        <ResetPasswordForm
          token={token}
          onReset={async () => {
            await navigate({ to: "/sign-in" });
            toast.success("Password changed", { description: "Sign in with your new password." });
          }}
        />
      )}
    </GuestCard>
  );
}
