import { Link } from "@tanstack/react-router";

import { PasswordResetRequestForm } from "#/features/identity/password-reset-request-form.tsx";
import { GuestCard } from "#/features/identity/guest-card.tsx";

export function PasswordResetRequestPage() {
  return (
    <GuestCard
      title="Reset your password"
      description="We will send a link to your email to choose a new one."
    >
      <PasswordResetRequestForm />
      <p className="mt-4 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link to="/sign-in" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </GuestCard>
  );
}
