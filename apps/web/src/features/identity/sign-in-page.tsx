import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { redirectTarget } from "#/features/identity/redirect-target.ts";
import { SignInForm } from "#/features/identity/sign-in-form.tsx";

export function SignInPage() {
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_guest/sign-in" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>Find your todos where you left them.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm
          onSignedIn={async (user) => {
            await setCurrentUser(user);
            await navigate({ href: redirectTarget(search.redirect) });
          }}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Not signed up yet?{" "}
          <Link to="/sign-up" className="text-foreground underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
