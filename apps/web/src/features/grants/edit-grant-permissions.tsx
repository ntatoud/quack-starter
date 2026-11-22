import { type Grant, grantablePermissions } from "@quack/contracts/grants/grant";
import type { Permission } from "@quack/contracts/permission";
import { Button } from "@quack/ui/components/button";
import { Checkbox } from "@quack/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@quack/ui/components/dialog";
import { Field, FieldLabel, FieldSet } from "@quack/ui/components/field";
import { useMutation } from "@tanstack/react-query";
import { Array as Arr } from "effect";
import { Fragment, useState } from "react";

import { PermissionBadge } from "#/features/grants/permission-badge.tsx";
import { api } from "#/lib/api.ts";
import { invalidating } from "#/lib/invalidate-queries.ts";
import { listOf, listParts } from "#/lib/list-of.ts";
import { toggled } from "#/lib/toggled.ts";

/**
 * "Claude gains todos:delete and loses todos:write, from its next call.", in parts: words, and lists of Permissions,
 * which the dialog shows as badges.
 */
type SentencePart =
  | { readonly _tag: "Words"; readonly key: string; readonly text: string }
  | {
      readonly _tag: "Permissions";
      readonly key: string;
      readonly permissions: ReadonlyArray<Permission>;
    };

const words = (key: string, text: string): SentencePart => ({ _tag: "Words", key, text });

const changeSentence = (
  name: string,
  added: ReadonlyArray<Permission>,
  removed: ReadonlyArray<Permission>,
): ReadonlyArray<SentencePart> => [
  words("name", name),
  ...(added.length > 0
    ? [
        words("gains", " gains "),
        { _tag: "Permissions", key: "added", permissions: added } as const,
      ]
    : []),
  ...(added.length > 0 && removed.length > 0 ? [words("and", " and")] : []),
  ...(removed.length > 0
    ? [
        words("loses", " loses "),
        { _tag: "Permissions", key: "removed", permissions: removed } as const,
      ]
    : []),
  words("end", ", from its next call."),
];

function Badges({ permissions }: { permissions: ReadonlyArray<Permission> }) {
  return listParts(permissions).map(({ separator, word }) => (
    <Fragment key={word}>
      {separator}
      <PermissionBadge permission={word} />
    </Fragment>
  ));
}

/**
 * The User chooses the Permissions of the Grant, fewer or more, then reviews what changes before it does: all at once,
 * on confirm. Never none, which revoking covers.
 */
export function EditGrantPermissions({ grant }: { grant: Grant }) {
  const name = grant.aiClient.name;
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [ticked, setTicked] = useState<ReadonlySet<Permission>>(new Set(grant.permissions));

  const change = useMutation(
    api.grants.changePermissions.mutationOptions(invalidating(api.grants.key())),
  );

  const chosen = grantablePermissions.filter((permission) => ticked.has(permission));
  const added = chosen.filter((permission) => !grant.permissions.includes(permission));
  const removed = grant.permissions.filter((permission) => !ticked.has(permission));
  const title = `Change ${name}'s permissions?`;

  const sentence = changeSentence(name, added, removed);

  // As text for a screen reader and an agent.
  const consequence = sentence
    .map((part) => (part._tag === "Words" ? part.text : listOf(part.permissions)))
    .join("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing while the request runs would hide whether it succeeded.
        if (change.isPending) return;
        change.reset();
        setReviewing(false);

        // Opens on what the Grant holds now, whatever was left unconfirmed before.
        if (next) setTicked(new Set(grant.permissions));
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" aria-label={`Edit ${name}'s permissions`} />}
      >
        Edit
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        {reviewing ? (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {/* A badge is a box of its own, which a screen reader would set apart from the comma after it. */}
                <span className="sr-only">{consequence}</span>
                <span aria-hidden>
                  {sentence.map((part) =>
                    part._tag === "Words" ? (
                      <Fragment key={part.key}>{part.text}</Fragment>
                    ) : (
                      <Badges key={part.key} permissions={part.permissions} />
                    ),
                  )}
                </span>
              </DialogDescription>
            </DialogHeader>
            <p role="alert" className="text-sm text-destructive empty:hidden">
              {change.isError ? `Could not change ${name}'s permissions. Try again.` : ""}
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={change.isPending}
                onClick={() => {
                  change.reset();
                  setReviewing(false);
                }}
              >
                Back
              </Button>
              <Button
                disabled={change.isPending || !Arr.isReadonlyArrayNonEmpty(chosen)}
                onClick={() => {
                  if (!Arr.isReadonlyArrayNonEmpty(chosen)) return;
                  change.mutate(
                    { params: { id: grant.id }, payload: { permissions: chosen } },
                    { onSuccess: () => setOpen(false) },
                  );
                }}
                data-agent-confirm={`${title} ${consequence}`}
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Edit {name}'s permissions</DialogTitle>
              <DialogDescription>
                What {name} may do for you. To lose every one, revoke it instead.
              </DialogDescription>
            </DialogHeader>
            <FieldSet className="gap-3">
              {grantablePermissions.map((permission) => (
                <Field key={permission} orientation="horizontal">
                  <Checkbox
                    checked={ticked.has(permission)}
                    onCheckedChange={(checked) =>
                      setTicked((current) => toggled(current, permission, checked === true))
                    }
                  />
                  <FieldLabel>
                    <code>{permission}</code>
                  </FieldLabel>
                </Field>
              ))}
            </FieldSet>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                disabled={chosen.length === 0 || added.length + removed.length === 0}
                onClick={() => setReviewing(true)}
              >
                Review
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
