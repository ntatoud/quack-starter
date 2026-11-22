import { Button } from "@quack/ui/components/button";
import { LogOutIcon } from "lucide-react";

import { useSignOut } from "#/features/identity/use-sign-out.ts";

export function SignOutButton({ className }: { className?: string }) {
  const signOut = useSignOut();

  return (
    <div className={className}>
      <Button
        variant="destructive"
        className="w-full"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate(undefined)}
      >
        <LogOutIcon aria-hidden />
        {signOut.isPending ? "Signing out…" : "Sign out"}
      </Button>
      {signOut.isError && (
        <p role="alert" className="mt-2 text-center text-xs text-destructive">
          Could not sign out. Try again.
        </p>
      )}
    </div>
  );
}
