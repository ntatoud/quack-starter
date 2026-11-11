import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quack/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";

import { useSetCurrentUser } from "#/features/identity/current-user.ts";
import { SignUpForm } from "#/features/identity/sign-up-form.tsx";

export const Route = createFileRoute("/sign-up")({ component: SignUp });

function SignUp() {
  const setCurrentUser = useSetCurrentUser();
  const navigate = Route.useNavigate();

  return (
    <main className="mx-auto max-w-xl p-6 pt-16">
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
    </main>
  );
}
