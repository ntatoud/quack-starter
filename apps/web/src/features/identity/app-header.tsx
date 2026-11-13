import type { User } from "@quack/contracts/identity/user";
import { Link } from "@tanstack/react-router";

import { ButtonLink } from "#/components/button-link.tsx";
import { SignOutButton } from "#/features/identity/sign-out-button.tsx";

export function AppHeader({ currentUser }: { currentUser: typeof User.Encoded | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-6 py-3 text-sm">
        <Link to="/" className="font-semibold">
          Quack
        </Link>
        {currentUser === null ? (
          <nav className="flex items-center gap-2">
            <ButtonLink to="/sign-in" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink to="/sign-up" size="sm">
              Sign up
            </ButtonLink>
          </nav>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-muted-foreground">{currentUser.email}</span>
            <SignOutButton />
          </div>
        )}
      </div>
    </header>
  );
}
