import type { Grant } from "@quack/contracts/grants/grant";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@quack/ui/components/alert-dialog";
import { Badge } from "@quack/ui/components/badge";
import { Button } from "@quack/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { DateTime } from "effect";
import { useState } from "react";

import { EditGrantPermissions } from "#/features/grants/edit-grant-permissions.tsx";
import { api } from "#/lib/api.ts";
import { invalidating } from "#/lib/invalidate-queries.ts";
import { listOf } from "#/lib/list-of.ts";
import { timeAgo } from "#/lib/time-ago.ts";

export function GrantEntry({
  grant,
  attention,
  now,
}: {
  grant: Grant;
  attention: ReadonlyArray<string>;
  now: Date;
}) {
  const name = grant.aiClient.name;

  return (
    <li aria-label={name} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm wrap-anywhere">
          <strong className="font-medium">{name}</strong>{" "}
          <span className="text-muted-foreground">from {grant.aiClient.host}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {grant.lastUsedAt === null ? (
            "Never used yet"
          ) : (
            <time dateTime={DateTime.formatIso(grant.lastUsedAt)}>
              Used {timeAgo(DateTime.toDateUtc(grant.lastUsedAt), now)}
            </time>
          )}
        </p>
        <ul aria-label="Permissions" className="flex flex-wrap gap-1">
          {grant.permissions.map((permission) => (
            <li key={permission}>
              {/* What a delete removes, a User cannot get back. */}
              <Badge variant={permission.endsWith(":delete") ? "destructive" : "secondary"}>
                {permission}
              </Badge>
            </li>
          ))}
        </ul>
        {attention.length > 0 && (
          <ul aria-label="Why it needs a look" className="flex flex-wrap gap-1">
            {attention.map((reason) => (
              <li key={reason}>
                <Badge
                  variant="outline"
                  className="border-amber-600/50 text-amber-700 dark:text-amber-400"
                >
                  {reason}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <EditGrantPermissions grant={grant} />
        <RevokeGrant grant={grant} />
      </div>
    </li>
  );
}

/** Asks before revoking, and stays open until it succeeds: a failure is said in the dialog, which can be retried. */
function RevokeGrant({ grant }: { grant: Grant }) {
  const [open, setOpen] = useState(false);
  const revoke = useMutation(api.grants.revoke.mutationOptions(invalidating(api.grants.key())));
  const name = grant.aiClient.name;
  const title = `Revoke ${name}'s access?`;
  const consequence = `${name} loses ${listOf(grant.permissions)} at once. To act for you again, it has to ask for your consent.`;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Closing while the request runs would hide whether it succeeded.
        if (revoke.isPending) return;
        revoke.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger
        render={<Button variant="destructive" size="sm" aria-label={`Revoke ${name}`} />}
      >
        Revoke
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {revoke.isError ? `Could not revoke ${name}. Try again.` : ""}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>Keep access</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.isPending}
            onClick={() =>
              revoke.mutate({ params: { id: grant.id } }, { onSuccess: () => setOpen(false) })
            }
            data-agent-confirm={`${title} ${consequence}`}
          >
            Revoke access
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
