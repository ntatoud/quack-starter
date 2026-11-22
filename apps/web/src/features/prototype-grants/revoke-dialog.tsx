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
import { Button } from "@quack/ui/components/button";

import { consequence, type Grant } from "#/features/prototype-grants/grants-data.ts";

export function RevokeDialog({ grant, onRevoke }: { grant: Grant; onRevoke: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm" aria-label={`Revoke ${grant.clientName}`} />
        }
      >
        Revoke
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke {grant.clientName}'s access?</AlertDialogTitle>
          <AlertDialogDescription>{consequence(grant)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep access</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onRevoke}>
            Revoke access
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
