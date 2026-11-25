import { EmailAlreadyTaken, ExpiredLink } from "@quack/contracts/identity/identity-errors";
import { Button } from "@quack/ui/components/button";
import { useMutation } from "@tanstack/react-query";

import { ExpiredEmailLink } from "#/features/email-change/expired-email-link.tsx";
import { api } from "#/lib/api.ts";

/** Confirms an Email Change, signed in or not: the token is the proof. */
export function ConfirmEmail({
  token,
  onConfirmed,
}: {
  token: string;
  onConfirmed: () => void | Promise<void>;
}) {
  const confirmEmailChange = useMutation({
    ...api.identity.confirmEmailChange.mutationOptions(),
    onSuccess: () => onConfirmed(),
  });

  if (confirmEmailChange.error instanceof ExpiredLink) return <ExpiredEmailLink />;

  return (
    <div className="flex flex-col gap-4">
      {confirmEmailChange.error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {confirmEmailChange.error instanceof EmailAlreadyTaken
            ? "Another account has taken this email since you asked for it. Your email has not changed."
            : "Could not confirm the email. Try again."}
        </p>
      )}
      <Button
        disabled={confirmEmailChange.isPending || confirmEmailChange.isSuccess}
        onClick={() => confirmEmailChange.mutate({ payload: { token } })}
      >
        Confirm this email
      </Button>
    </div>
  );
}
