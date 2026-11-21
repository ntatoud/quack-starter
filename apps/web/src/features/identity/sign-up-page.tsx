import { Link, useNavigate } from "@tanstack/react-router";

import { GuestCard } from "#/features/identity/guest-card.tsx";
import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { SignUpForm } from "#/features/identity/sign-up-form.tsx";

export function SignUpPage() {
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();

  return (
    <GuestCard title="Sign up" description="Your todos are yours alone.">
      <SignUpForm
        onSignedUp={async (user) => {
          await setCurrentUser(user);
          await navigate({ to: "/app" });
        }}
      />
      <p className="mt-4 text-sm text-muted-foreground">
        Already signed up?{" "}
        <Link to="/sign-in" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </GuestCard>
  );
}
