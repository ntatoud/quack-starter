import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import { Link, useNavigate } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { SignUpForm } from "#/features/identity/sign-up-form.tsx";

export function SignUpPage() {
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sign up</h1>
        </CardTitle>
        <CardDescription>Your todos are yours alone.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm
          onSignedUp={async (user) => {
            await setCurrentUser(user);
            await navigate({ to: "/app" });
          }}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Already signed up?{" "}
          <Link to="/sign-in" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
