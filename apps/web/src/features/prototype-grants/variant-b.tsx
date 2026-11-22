import { Button } from "@quack/ui/components/button";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import {
  absolute,
  actions,
  type Grant,
  permissionLabel,
  relative,
} from "#/features/prototype-grants/grants-data.ts";
import { GrantsEmpty } from "#/features/prototype-grants/grants-empty.tsx";

export function VariantB({
  grants,
  onRevoke,
  onRevokeAll,
}: {
  grants: Grant[];
  onRevoke: (id: string) => void;
  onRevokeAll: () => void;
}) {
  const [confirmingAll, setConfirmingAll] = useState(false);
  if (grants.length === 0) return <GrantsEmpty />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {grants.length === 1 ? "1 AI Client can" : `${grants.length} AI Clients can`} act for you.
        </p>
        {confirmingAll ? (
          <Confirm
            question="Cut off every AI Client? There is no undo."
            confirmLabel="Yes, revoke all"
            onConfirm={() => {
              setConfirmingAll(false);
              onRevokeAll();
            }}
            onCancel={() => setConfirmingAll(false)}
          />
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirmingAll(true)}>
            Revoke all
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {grants.map((grant) => (
          <li key={grant.id}>
            <GrantCard grant={grant} onRevoke={() => onRevoke(grant.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function GrantCard({ grant, onRevoke }: { grant: Grant; onRevoke: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const detailsId = `grant-${grant.id}-details`;

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <p className="text-base">
        <strong className="font-medium">{grant.clientName}</strong>, from {grant.origin}, can{" "}
        {actions(grant.permissions)}. Last used {relative(grant.lastUsedAt)}.
      </p>
      {grant.loopbackOnly ? (
        <p className="text-sm text-muted-foreground">
          It runs on this machine, so only a program on your own computer can use it.
        </p>
      ) : null}
      {open ? (
        <dl
          id={detailsId}
          className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm"
        >
          <dt className="text-muted-foreground">Calls itself</dt>
          <dd>"{grant.clientName}" (its own claim, not checked)</dd>
          <dt className="text-muted-foreground">Verified origin</dt>
          <dd>{grant.origin}</dd>
          <dt className="text-muted-foreground">Allowed to</dt>
          <dd>{grant.permissions.map((p) => permissionLabel[p]).join(", ")}</dd>
          <dt className="text-muted-foreground">Given</dt>
          <dd>{absolute(grant.givenAt)}</dd>
          <dt className="text-muted-foreground">Expires</dt>
          <dd>
            {relative(grant.expiresAt)} ({absolute(grant.expiresAt)}), unless it is used again
          </dd>
        </dl>
      ) : null}
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide details" : "Details"}
          <ChevronDownIcon aria-hidden className={open ? "rotate-180" : undefined} />
        </Button>
        {confirming ? (
          <Confirm
            question={`Cut ${grant.clientName} off? There is no undo.`}
            confirmLabel="Yes, revoke"
            onConfirm={onRevoke}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <Button
            variant="destructive"
            size="sm"
            aria-label={`Revoke ${grant.clientName}`}
            onClick={() => setConfirming(true)}
          >
            Revoke
          </Button>
        )}
      </div>
    </article>
  );
}

function Confirm(props: {
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label="Confirm" className="flex flex-wrap items-center gap-2">
      <span className="text-sm">{props.question}</span>
      <Button variant="outline" size="sm" onClick={props.onCancel}>
        Cancel
      </Button>
      <Button variant="destructive" size="sm" autoFocus onClick={props.onConfirm}>
        {props.confirmLabel}
      </Button>
    </div>
  );
}
