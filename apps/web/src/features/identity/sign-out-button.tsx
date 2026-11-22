import { Button } from "@quack/ui/components/button";
import { LogOutIcon } from "lucide-react";

import { signOutFailed, signOutLabel, useSignOut } from "#/features/identity/use-sign-out.ts";

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
        {signOutLabel(signOut)}
      </Button>
      {signOut.isError && (
        <p role="alert" className="mt-2 text-center text-xs text-destructive">
          {signOutFailed}
        </p>
      )}
    </div>
  );
}
