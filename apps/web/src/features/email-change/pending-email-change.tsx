import { Button } from "@quack/ui/components/button";
import { SettingsCard } from "@quack/ui/components/settings-card";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "#/lib/api.ts";

/** An Email Change waiting for its link: where to look for it, and a way to make it stop working. */
export function PendingEmailChange({ pendingEmail }: { pendingEmail: string }) {
  const queryClient = useQueryClient();

  const cancelEmailChange = useMutation({
    ...api.identity.cancelEmailChange.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.identity.me.key() }),
  });

  return (
    <SettingsCard>
      <div className="flex flex-col gap-3 px-5 py-4 @xl:flex-row @xl:items-center @xl:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <p role="status" className="text-sm font-medium">
            Check your inbox at <span className="break-all">{pendingEmail}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Open the link we sent there to make it your email. Until then, it stays the same.
          </p>
          {cancelEmailChange.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not cancel the change. Try again.
            </p>
          )}
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          disabled={cancelEmailChange.isPending}
          onClick={() => cancelEmailChange.mutate({})}
        >
          Cancel the change
        </Button>
      </div>
    </SettingsCard>
  );
}
