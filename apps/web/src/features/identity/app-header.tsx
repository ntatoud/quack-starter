import type { User } from "@quack/contracts/identity/user";
import { Link } from "@tanstack/react-router";

export function AppHeader({ currentUser }: { currentUser: typeof User.Encoded | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-6 py-3 text-sm">
        <Link to="/" className="font-semibold">
          Quack
        </Link>
        {currentUser === null ? (
          <Link to="/sign-up" className="underline-offset-4 hover:underline">
            Sign up
          </Link>
        ) : (
          <span className="truncate text-muted-foreground">{currentUser.email}</span>
        )}
      </div>
    </header>
  );
}
