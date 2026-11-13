import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import { useNavigate } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { SignUpForm } from "#/features/identity/sign-up-form.tsx";

/** The sign-up page: once signed up, the User is the Current User and lands on the home page. */
export function SignUpCard() {
  const setCurrentUser = useSetCurrentUser();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign up</CardTitle>
        <CardDescription>Your todos are yours alone.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm
          onSignedUp={async (user) => {
            await setCurrentUser(user);
            await navigate({ to: "/" });
          }}
        />
      </CardContent>
    </Card>
  );
}
