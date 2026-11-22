import type { User } from "@quack/contracts/identity/user";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import { GuestCard } from "#/features/identity/guest-card.tsx";
import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { DevQuickSignIn } from "#/features/identity/dev-quick-sign-in.tsx";
import { redirectTarget } from "#/features/identity/redirect-target.ts";
import { SignInForm } from "#/features/identity/sign-in-form.tsx";

export function SignInPage() {
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_guest/sign-in" });

  const onSignedIn = async (user: User) => {
    await setCurrentUser(user);
    await navigate({ href: redirectTarget(search.redirect) });
  };

  return (
    <GuestCard title="Sign in" description="Find your todos where you left them.">
      <SignInForm onSignedIn={onSignedIn} />
      <p className="mt-4 text-sm">
        <Link
          to="/forgot-password"
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Not signed up yet?{" "}
        <Link to="/sign-up" className="font-medium text-foreground underline underline-offset-4">
          Sign up
        </Link>
      </p>
      {import.meta.env.DEV && <DevQuickSignIn onSignedIn={onSignedIn} />}
    </GuestCard>
  );
}
